import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { sendEmail } from '@/lib/email';
import { getXAppCredentials } from '@/lib/x-oauth';
import { verifyBearerToken } from '@/lib/auth-utils';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

// Cron job to refresh expiring social media tokens
// Called every hour by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find accounts with tokens expiring within 7 days
    const expiringAccounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          not: null,
          lte: sevenDaysFromNow,
        },
      },
    });

    if (expiringAccounts.length === 0) {
      return NextResponse.json({
        message: 'No tokens need refreshing',
        checked: 0,
        refreshed: 0,
        failed: 0,
      });
    }

    console.log(`[Token Refresh] Found ${expiringAccounts.length} account(s) with expiring tokens`);

    let refreshedCount = 0;
    let failedCount = 0;
    const failedAccounts: Array<{ account: string; platform: string; error: string }> = [];

    for (const account of expiringAccounts) {
      try {
        if (account.platform === 'X') {
          // Refresh X (Twitter) token
          if (!account.refreshToken) {
            throw new Error('No refresh token available');
          }

          const refreshToken = decrypt(account.refreshToken);

          // Look up app credentials by account handle
          const accountHandle = account.accountHandle.toLowerCase();
          const appCredentials = getXAppCredentials(accountHandle);

          if (!appCredentials) {
            throw new Error('X client credentials not configured');
          }

          const { clientId, clientSecret } = appCredentials;

          const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: clientId,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            throw new Error(`X token refresh failed: ${tokenResponse.status} - ${JSON.stringify(errorData)}`);
          }

          const tokenData = await tokenResponse.json();

          // Update account with new tokens
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 7200));

          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              accessToken: encrypt(tokenData.access_token),
              refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : account.refreshToken,
              tokenExpiresAt: expiresAt,
            },
          });

          console.log(`[Token Refresh] Refreshed X token for: ${account.accountName}`);
          refreshedCount++;
        } else if (account.platform === 'FACEBOOK') {
          // Facebook long-lived page tokens typically don't expire
          // But if we need to refresh, exchange for a new long-lived token
          const accessToken = decrypt(account.accessToken);

          const fbClientId = process.env.FACEBOOK_APP_ID;
          const fbClientSecret = process.env.FACEBOOK_APP_SECRET;

          if (!fbClientId || !fbClientSecret) {
            console.log(`[Token Refresh] Facebook credentials not configured, skipping ${account.accountName}`);
            continue;
          }

          const exchangeUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
          exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
          exchangeUrl.searchParams.set('client_id', fbClientId);
          exchangeUrl.searchParams.set('client_secret', fbClientSecret);
          exchangeUrl.searchParams.set('fb_exchange_token', accessToken);

          const fbResponse = await fetch(exchangeUrl.toString(), {
            signal: AbortSignal.timeout(30000),
          });

          if (!fbResponse.ok) {
            const errorData = await fbResponse.json().catch(() => ({}));
            throw new Error(`Facebook token exchange failed: ${fbResponse.status} - ${JSON.stringify(errorData)}`);
          }

          const fbData = await fbResponse.json();

          // Update account with new token
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + (fbData.expires_in || 5184000)); // Default 60 days

          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              accessToken: encrypt(fbData.access_token),
              tokenExpiresAt: expiresAt,
            },
          });

          console.log(`[Token Refresh] Refreshed Facebook token for: ${account.accountName}`);
          refreshedCount++;
        } else {
          console.log(`[Token Refresh] Unsupported platform: ${account.platform} for ${account.accountName}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Token Refresh] Failed to refresh token for ${account.accountName}:`, errorMessage);

        failedAccounts.push({
          account: account.accountName,
          platform: account.platform,
          error: errorMessage,
        });

        failedCount++;
      }
    }

    // Raise or resolve system alert based on results
    if (failedAccounts.length > 0) {
      const names = failedAccounts.map((f) => f.account).join(', ');
      await raiseAlert('token_refresh_failed', `Token refresh failed for: ${names}`);
    } else if (expiringAccounts.length > 0) {
      await resolveAlert('token_refresh_failed');
    }

    // Send email alert if any refreshes failed
    if (failedAccounts.length > 0) {
      try {
        const adminUsers = await prisma.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true,
          },
          select: {
            email: true,
          },
        });

        const adminEmails = adminUsers.map((u) => u.email);

        if (adminEmails.length > 0) {
          const failedList = failedAccounts
            .map(
              (f) =>
                `<li><strong>${f.account}</strong> (${f.platform}): ${f.error}</li>`
            )
            .join('');

          await sendEmail({
            to: adminEmails,
            subject: 'Social Token Refresh Failed',
            html: `
              <p style="color:#192842;font-size:15px;line-height:1.6;">
                The following social media accounts failed to refresh their access tokens:
              </p>
              <ul style="color:#192842;font-size:14px;line-height:1.8;">
                ${failedList}
              </ul>
              <p style="color:#192842;font-size:15px;line-height:1.6;">
                These accounts may need to be re-authenticated manually to continue posting.
              </p>
              <div style="margin:24px 0;padding:16px;background:#fef2f2;border-left:4px solid #D42B2B;border-radius:0 4px 4px 0;">
                <p style="margin:0;color:#465f94;font-size:13px;">
                  Please check the Social Accounts section in the newsroom dashboard.
                </p>
              </div>
            `,
          });

          console.log(`[Token Refresh] Sent failure alert to ${adminEmails.length} admin(s)`);
        }
      } catch (emailError) {
        console.error('[Token Refresh] Failed to send email alert:', emailError);
      }
    }

    return NextResponse.json({
      message: `Refreshed ${refreshedCount} of ${expiringAccounts.length} token(s)`,
      checked: expiringAccounts.length,
      refreshed: refreshedCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('[Token Refresh] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh social tokens' },
      { status: 500 }
    );
  }
}
