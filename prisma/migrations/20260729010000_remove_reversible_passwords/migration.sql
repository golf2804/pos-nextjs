ALTER TABLE "user_profiles"
ADD COLUMN "password_updated_at" TIMESTAMP(3);

UPDATE "user_profiles" AS profile
SET "password_updated_at" = credential."updated_at"
FROM "managed_credentials" AS credential
WHERE credential."user_id" = profile."id";

UPDATE "user_profiles"
SET "password_updated_at" = "updated_at"
WHERE "password_updated_at" IS NULL;

DROP TABLE "managed_credentials";
