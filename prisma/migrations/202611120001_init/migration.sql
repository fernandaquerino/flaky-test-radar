-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('passed', 'failed', 'flaky', 'skipped');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ciRunId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawReport" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "titlePath" TEXT[],
    "playwrightProject" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "retries" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" VARCHAR(2048),

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTestStat" (
    "testCaseId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "executions" INTEGER NOT NULL,
    "flakyCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,

    CONSTRAINT "DailyTestStat_pkey" PRIMARY KEY ("testCaseId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_projectId_idx" ON "ApiToken"("projectId");

-- CreateIndex
CREATE INDEX "Upload_status_createdAt_idx" ON "Upload"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_projectId_createdAt_idx" ON "Upload"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_projectId_ciRunId_attempt_key" ON "Upload"("projectId", "ciRunId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_projectId_stableKey_key" ON "TestCase"("projectId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "TestRun_uploadId_key" ON "TestRun"("uploadId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_startedAt_idx" ON "TestRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "TestRun_projectId_commitSha_idx" ON "TestRun"("projectId", "commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_testCaseId_testRunId_key" ON "TestResult"("testCaseId", "testRunId");

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTestStat" ADD CONSTRAINT "DailyTestStat_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

