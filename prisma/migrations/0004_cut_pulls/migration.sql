-- "Broadcast Cuts" feature (docs/grabien-clipper-feature-design.md §5/§6).
-- Hand-authored to match schema.prisma's CutPull model -- `prisma migrate dev`
-- could not run in this session (no local DATABASE_URL configured), so this
-- follows the same manual-SQL path CLAUDE.md documents for hotfixes. Verify
-- column-for-column against schema.prisma before deploy; run
-- `npx prisma@5.22.0 migrate diff` against a real DB before merging if one
-- becomes available, to double check this by hand.

-- CreateTable
CREATE TABLE "cut_pulls" (
    "id" TEXT NOT NULL,
    "wrapper_job_id" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'QUEUED',
    "candidate_json" JSONB NOT NULL,
    "intended_start_ms" INTEGER NOT NULL,
    "intended_end_ms" INTEGER NOT NULL,
    "raw_duration_s" INTEGER,
    "mp4_path" TEXT,
    "metadata_path" TEXT,
    "error_stage" TEXT,
    "error_message" TEXT,
    "trim_intent_json" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cut_pulls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cut_pulls_stage_idx" ON "cut_pulls"("stage");

-- CreateIndex
CREATE INDEX "cut_pulls_created_at_idx" ON "cut_pulls"("created_at");

-- AddForeignKey
ALTER TABLE "cut_pulls" ADD CONSTRAINT "cut_pulls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
