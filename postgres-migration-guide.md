# PostgreSQL Migration Guide

**Source DB:** `jdbc:postgresql://72.62.70.81:5432/pos`  
**Panel:** Coolify

---

## Step 1: Dump the Database from Old Server

SSH into the old server and run:

```bash
pg_dump -h 72.62.70.81 -p 5432 -U <your_db_user> -d pos -F c -f pos_backup.dump
```

Or if running locally on the server:

```bash
pg_dump -U <your_db_user> -d pos -F c -f pos_backup.dump
```

If PostgreSQL is inside a Docker container (common with Coolify):

```bash
docker exec -t <postgres_container_name> pg_dump -U <your_db_user> pos > pos_backup.dump
```

---

## Step 2: Copy the Dump to New Server

```bash
scp pos_backup.dump user@<new_server_ip>:/home/user/
```

---

## Step 3: Set Up PostgreSQL on New Server via Coolify

1. Log into the **Coolify panel** on the new server
2. Go to **Resources** → **New Resource** → **Database** → **PostgreSQL**
3. Configure with the same DB name (`pos`), user, and password
4. Deploy — Coolify will spin up a PostgreSQL container

---

## Step 4: Restore the Database

Find the new container name:

```bash
docker ps | grep postgres
```

Copy dump into container and restore:

```bash
docker cp pos_backup.dump <new_container_name>:/tmp/
docker exec -t <new_container_name> pg_restore -U <your_db_user> -d pos /tmp/pos_backup.dump
```

---

## Step 5: Update App Connection String

Update JDBC URL in your app (set via Coolify environment variables):

```
jdbc:postgresql://<new_server_ip>:5432/pos
```

---

## Step 6: Verify Migration

```bash
docker exec -it <new_container_name> psql -U <your_db_user> -d pos -c "\dt"
```

This should list all tables, confirming the migration succeeded.

---

## Notes

- Run migration during **low traffic** to avoid data loss
- For zero-downtime migration, use `pg_basebackup` + replication
- Ensure port `5432` is open in the new server's firewall for external access
- Replace all `<placeholders>` with your actual values before running commands
