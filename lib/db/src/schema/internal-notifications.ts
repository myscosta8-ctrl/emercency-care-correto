import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const internalNotificationsTable = pgTable("internal_notifications", {
  id:          serial("id").primaryKey(),
  senderId:    integer("sender_id").notNull().default(0),
  senderName:  text("sender_name").notNull().default("Sistema"),
  recipientId: integer("recipient_id"),
  patientId:   integer("patient_id"),
  patientName: text("patient_name").notNull().default(""),
  type:        text("type").notNull().default("observacao"),
  title:       text("title").notNull().default(""),
  message:     text("message").notNull().default(""),
  readAt:      timestamp("read_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type InternalNotification = typeof internalNotificationsTable.$inferSelect;
