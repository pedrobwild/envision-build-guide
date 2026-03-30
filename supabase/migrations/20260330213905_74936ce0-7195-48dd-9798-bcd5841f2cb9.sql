
-- The ALL policy already covers DELETE for authenticated users, but we need to verify.
-- Actually the existing "Users manage tours via budget ownership" policy with ALL already covers INSERT, UPDATE, DELETE, SELECT for authenticated.
-- No additional migration needed.
SELECT 1;
