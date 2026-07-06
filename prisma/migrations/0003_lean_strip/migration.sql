-- DESTRUCTIVE lean-strip migration (2026-07-06). NOT auto-applied locally.
-- Drops the social-publishing + story-intelligence tables/enums. Back up the
-- production DB before deploy — deploy.yml runs `prisma migrate deploy`.

-- Orphan spotlight table: removed at the code level in the calendar/spotlight
-- unit, but the table exists on prod and is NOT in schema.prisma, so migrate
-- diff can't see it. Its FKs into story_intelligence would otherwise block the
-- DROP TABLE below. Verified on prod: 0 rows, nothing references it.
DROP TABLE IF EXISTS "conservative_spotlight_runs";

-- DropForeignKey
ALTER TABLE "social_accounts" DROP CONSTRAINT "social_accounts_publish_target_id_fkey";

-- DropForeignKey
ALTER TABLE "social_posts" DROP CONSTRAINT "social_posts_article_id_fkey";

-- DropForeignKey
ALTER TABLE "social_posts" DROP CONSTRAINT "social_posts_social_account_id_fkey";

-- DropForeignKey
ALTER TABLE "site_voice_profiles" DROP CONSTRAINT "site_voice_profiles_publish_target_id_fkey";

-- DropForeignKey
ALTER TABLE "story_intelligence" DROP CONSTRAINT "story_intelligence_claimed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "story_intelligence" DROP CONSTRAINT "story_intelligence_article_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_sources" DROP CONSTRAINT "verification_sources_story_id_fkey";

-- DropForeignKey
ALTER TABLE "story_feedback" DROP CONSTRAINT "story_feedback_story_id_fkey";

-- DropForeignKey
ALTER TABLE "story_feedback" DROP CONSTRAINT "story_feedback_user_id_fkey";

-- DropTable
DROP TABLE "social_accounts";

-- DropTable
DROP TABLE "social_posts";

-- DropTable
DROP TABLE "site_voice_profiles";

-- DropTable
DROP TABLE "story_intelligence";

-- DropTable
DROP TABLE "topic_profiles";

-- DropTable
DROP TABLE "verification_sources";

-- DropTable
DROP TABLE "story_feedback";

-- DropEnum
DROP TYPE "SocialPostStatus";

-- DropEnum
DROP TYPE "VerificationStatus";

-- DropEnum
DROP TYPE "AlertLevel";

-- DropEnum
DROP TYPE "StoryOutcome";

