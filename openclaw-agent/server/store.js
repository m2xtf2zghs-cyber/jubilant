import fs from "fs/promises";
import path from "path";
import { createInitialOpenClawState } from "../src/openclaw/data.js";
import fsSync from "fs";
import { config } from "./config.js";

function loadSqlMigration() {
  const migrationPath = path.resolve(process.cwd(), "server/migrations/0001_openclaw_core.sql");
  return fsSync.readFileSync(migrationPath, "utf8");
}

async function syncPostgresTables(client, state) {
  const json = (value) => JSON.stringify(value ?? null);
  const truncateTables = [
    "messages",
    "conversations",
    "mediator_tasks",
    "borrowers",
    "leads",
    "campaigns",
    "dsa_contacts",
    "mediators",
    "activity_feed",
    "scheduled_reports",
  ];

  for (const table of truncateTables) {
    await client.query(`delete from ${table}`);
  }

  for (const item of state.dsaContacts || []) {
    await client.query(
      `insert into dsa_contacts
      (id,name,phone,city,source,loan_types,tag,segment,first_contacted_at,last_contacted_at,last_reply_at,total_messages,reply_count,leads_referred,converted_count,commission_earned,engagement_level,preferred_language,updated_at)
      values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())`,
      [item.id, item.name, item.phone, item.city, item.source, json(item.loanTypes), item.tag, item.segment, item.firstContactedAt, item.lastContactedAt, item.lastReplyAt, item.totalMessages || 0, item.replyCount || 0, item.leadsReferred || 0, item.convertedCount || 0, item.commissionEarned || 0, item.engagementLevel, item.preferredLanguage]
    );
  }

  for (const item of state.campaigns || []) {
    await client.query(
      `insert into campaigns
      (id,name,segment,status,template,daily_limit,send_window,random_delay_range,started_at,sender_pool,today_sent,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
      [item.id, item.name, item.segment, item.status, item.template, item.dailyLimit || 0, item.sendWindow, item.randomDelayRange, item.startedAt, item.senderPool || 0, item.todaySent || 0]
    );
  }

  for (const item of state.mediators || []) {
    await client.query(
      `insert into mediators
      (id,name,phone,type,area,status,commission_rule,onboarding_date,agreement_status,tasks_assigned,tasks_completed,recovery_amount,documents_collected,avg_response_minutes,ptp_won,ptp_fulfilled,commission_earned,last_reported_at,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())`,
      [item.id, item.name, item.phone, item.type, item.area, item.status, item.commissionRule, item.onboardingDate, item.agreementStatus, item.tasksAssigned || 0, item.tasksCompleted || 0, item.recoveryAmount || 0, item.documentsCollected || 0, item.avgResponseMinutes || 0, item.ptpWon || 0, item.ptpFulfilled || 0, item.commissionEarned || 0, item.lastReportedAt]
    );
  }

  for (const item of state.leads || []) {
    await client.query(
      `insert into leads
      (id,name,phone,city,loan_type,amount,employment_type,employer,source_dsa_id,stage,created_at,next_action,days_in_stage,missing_documents,status_note,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now())`,
      [item.id, item.name, item.phone, item.city, item.loanType, item.amount || 0, item.employmentType, item.employer, item.sourceDsaId, item.stage, item.createdAt, item.nextAction, item.daysInStage || 0, json(item.missingDocuments), item.statusNote]
    );
  }

  for (const item of state.borrowers || []) {
    await client.query(
      `insert into borrowers
      (id,name,phone,city,loan_amount,emi,outstanding,days_past_due,due_date,payment_history,assigned_mediator_id,tag,ptp,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,now())`,
      [item.id, item.name, item.phone, item.city, item.loanAmount || 0, item.emi || 0, item.outstanding || 0, item.daysPastDue || 0, item.dueDate, json(item.paymentHistory), item.assignedMediatorId, item.tag, json(item.ptp)]
    );
  }

  for (const item of state.mediatorTasks || []) {
    await client.query(
      `insert into mediator_tasks
      (id,mediator_id,title,type,priority,due_at,status,notes,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
      [item.id, item.mediatorId, item.title, item.type, item.priority, item.dueAt, item.status, item.notes]
    );
  }

  for (const convo of state.conversations || []) {
    await client.query(
      `insert into conversations
      (id,contact_type,contact_id,contact_name,channel,priority,unread_count,last_message_at,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
      [convo.id, convo.contactType, convo.contactId, convo.contactName, convo.channel, convo.priority, convo.unreadCount || 0, convo.lastMessageAt]
    );

    for (const message of convo.messages || []) {
      await client.query(
        `insert into messages
        (id,conversation_id,direction,at,text,intent,handled_by,pending)
        values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [message.id, convo.id, message.direction, message.at, message.text, message.intent, message.handledBy, Boolean(message.pending)]
      );
    }
  }

  for (const item of state.activityFeed || []) {
    await client.query(`insert into activity_feed (id,at,lane,text) values ($1,$2,$3,$4)`, [item.id, item.at, item.lane, item.text]);
  }

  for (const item of state.scheduledReports || []) {
    await client.query(
      `insert into scheduled_reports (id,name,cadence,destination,status,updated_at)
      values ($1,$2,$3,$4,$5,now())`,
      [item.id, item.name, item.cadence, item.destination, item.status]
    );
  }

  await client.query(
    `insert into app_settings (singleton,payload,updated_at)
     values (true,$1::jsonb,now())
     on conflict (singleton)
     do update set payload = excluded.payload, updated_at = now()`,
    [json(state.settings)]
  );
}

async function createPostgresAdapter(databaseUrl) {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(loadSqlMigration());
  return {
    mode: "postgres",
    async load() {
      const result = await pool.query("select payload from openclaw_app_state where workspace = $1", ["default"]);
      return result.rows[0]?.payload || null;
    },
    async save(state) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `
            insert into openclaw_app_state (workspace, payload, updated_at)
            values ($1, $2::jsonb, now())
            on conflict (workspace)
            do update set payload = excluded.payload, updated_at = now()
          `,
          ["default", JSON.stringify(state)]
        );
        await syncPostgresTables(client, state);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function createFileAdapter(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return {
    mode: "file",
    async load() {
      try {
        const raw = await fs.readFile(absolutePath, "utf8");
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async save(state) {
      await fs.writeFile(absolutePath, JSON.stringify(state, null, 2), "utf8");
    },
    async close() {},
  };
}

export async function createStateStore({ databaseUrl, stateFile }) {
  const adapter = databaseUrl ? await createPostgresAdapter(databaseUrl) : await createFileAdapter(stateFile);
  let state = (await adapter.load()) || createInitialOpenClawState();

  await adapter.save(state);

  return {
    mode: adapter.mode,
    getState() {
      return state;
    },
    async replaceState(nextState) {
      state = nextState;
      await adapter.save(state);
      return state;
    },
    async reset() {
      state = createInitialOpenClawState();
      await adapter.save(state);
      return state;
    },
    async close() {
      await adapter.close();
    },
  };
}
