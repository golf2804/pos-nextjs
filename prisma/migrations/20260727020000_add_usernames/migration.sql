ALTER TABLE "user_profiles" ADD COLUMN "username" TEXT;

UPDATE "user_profiles"
SET "username" = lower(split_part("email", '@', 1))
WHERE "username" IS NULL;

ALTER TABLE "user_profiles" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");
