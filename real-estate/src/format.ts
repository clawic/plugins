import type { Task } from "./types.js";

export function formatTask(task: Task): string {
  const parts = [
    `${task.id}: ${task.title}`,
    `status=${task.status}`,
    `priority=${task.priority}`,
  ];

  if (task.project) {
    parts.push(`project=${task.project}`);
  }
  if (task.dueAt) {
    parts.push(`due=${task.dueAt}`);
  }
  if (task.scheduledFor) {
    parts.push(`scheduled=${task.scheduledFor}`);
  }
  if (task.tags.length) {
    parts.push(`tags=${task.tags.join(", ")}`);
  }
  if (task.checklist.length) {
    const completed = task.checklist.filter((item) => item.completed).length;
    parts.push(`checklist=${completed}/${task.checklist.length}`);
  }
  return parts.join(" | ");
}

export function formatTaskList(label: string, tasks: Task[]): string {
  if (!tasks.length) {
    return `${label}: none`;
  }
  return `${label}:\n${tasks.map((task) => `- ${formatTask(task)}`).join("\n")}`;
}
