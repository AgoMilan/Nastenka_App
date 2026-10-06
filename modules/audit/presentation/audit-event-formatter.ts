import type { AuditLogView } from "../domain/audit-views.ts";

export interface FormattedAuditEvent {
  readonly title: string;
  readonly description: string;
  readonly details?: { readonly label: string; readonly value: string }[];
}

function formatDateValue(val: unknown): string {
  if (!val) return "—";
  try {
    const d = new Date(val as string);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("cs-CZ");
  } catch {
    return String(val);
  }
}

/**
 * Formátovač auditních událostí do srozumitelného česky psaného textu pro UI.
 *
 * Bezpečnostní a privacy invarianty:
 * 1. ZÁKAZ zobrazení textu popisu úkolu (TASK_DESCRIPTION_CHANGED) – pouze indikace změny.
 * 2. ZÁKAZ zobrazení obsahu komentáře (TASK_COMMENT_*) – pouze indikace akce v diskuzi.
 * 3. Žádné soukromé poznámky (UserTaskNotes se vůbec neauditují).
 */
export function formatAuditEvent(log: AuditLogView): FormattedAuditEvent {
  const prev = log.previousState;
  const next = log.newState;

  switch (log.operation) {
    // ── Board Domain ───────────────────────────────────────────
    case "BOARD_CREATED": {
      const name = (next?.name as string) || "";
      return {
        title: "Vytvoření nástěnky",
        description: name ? `Nástěnka „${name}“ byla vytvořena.` : "Nástěnka byla vytvořena.",
      };
    }

    case "BOARD_UPDATED": {
      const oldName = prev?.name as string | undefined;
      const newName = next?.name as string | undefined;
      if (oldName && newName && oldName !== newName) {
        return {
          title: "Úprava nástěnky",
          description: `Název byl změněn z „${oldName}“ na „${newName}“.`,
        };
      }
      return {
        title: "Úprava nástěnky",
        description: "Nastavení nástěnky bylo upraveno.",
      };
    }

    case "BOARD_OWNER_TRANSFERRED": {
      return {
        title: "Převod vlastnictví",
        description: "Vlastnictví nástěnky bylo převedeno na jiného člena.",
      };
    }

    case "BOARD_DELETED": {
      return {
        title: "Smazání nástěnky",
        description: "Nástěnka byla smazána (přesunuta do koše).",
      };
    }

    // ── Membership Domain ──────────────────────────────────────
    case "MEMBER_ADDED": {
      const role = (next?.role as string) || "MEMBER";
      return {
        title: "Přidání člena",
        description: `Do nástěnky byl přidán člen s rolí ${role}.`,
      };
    }

    case "MEMBER_REMOVED": {
      const role = (prev?.role as string) || "MEMBER";
      return {
        title: "Odebrání člena",
        description: `Člen s rolí ${role} byl odebrán z nástěnky.`,
      };
    }

    case "MEMBER_LEFT_BOARD": {
      return {
        title: "Odchod z nástěnky",
        description: "Uživatel dobrovolně opustil nástěnku.",
      };
    }

    case "MEMBER_ROLE_CHANGED": {
      const oldRole = (prev?.role as string) || "—";
      const newRole = (next?.role as string) || "—";
      return {
        title: "Změna role člena",
        description: `Role člena byla změněna z ${oldRole} na ${newRole}.`,
      };
    }

    // ── Area Domain ────────────────────────────────────────────
    case "AREA_CREATED": {
      const name = (next?.name as string) || "";
      return {
        title: "Vytvoření oblasti",
        description: name ? `Byla vytvořena oblast „${name}“.` : "Byla vytvořena oblast.",
      };
    }

    case "AREA_UPDATED": {
      const oldName = prev?.name as string | undefined;
      const newName = next?.name as string | undefined;
      if (oldName && newName && oldName !== newName) {
        return {
          title: "Úprava oblasti",
          description: `Název oblasti byl změněn z „${oldName}“ na „${newName}“.`,
        };
      }
      return {
        title: "Úprava oblasti",
        description: "Oblast byla upravena.",
      };
    }

    case "AREA_DELETED": {
      const name = (prev?.name as string) || "";
      return {
        title: "Smazání oblasti",
        description: name ? `Oblast „${name}“ byla smazána.` : "Oblast byla smazána.",
      };
    }

    // ── Task Domain ────────────────────────────────────────────
    case "TASK_CREATED": {
      const title = (next?.title as string) || "";
      return {
        title: "Vytvoření úkolu",
        description: title ? `Úkol „${title}“ byl vytvořen.` : "Úkol byl vytvořen.",
      };
    }

    case "TASK_TITLE_CHANGED": {
      const oldTitle = (prev?.title as string) || "—";
      const newTitle = (next?.title as string) || "—";
      return {
        title: "Změna názvu úkolu",
        description: `Název byl změněn z „${oldTitle}“ na „${newTitle}“.`,
      };
    }

    case "TASK_DESCRIPTION_CHANGED": {
      return {
        title: "Změna popisu úkolu",
        description: "Popis úkolu byl upraven.",
      };
    }

    case "TASK_STATUS_CHANGED": {
      const oldStatus = (prev?.status as string) || "—";
      const newStatus = (next?.status as string) || "—";
      return {
        title: "Změna stavu",
        description: `Stav byl změněn: ${oldStatus} → ${newStatus}.`,
      };
    }

    case "TASK_PRIORITY_CHANGED": {
      const oldPri = (prev?.priority as string) || "—";
      const newPri = (next?.priority as string) || "—";
      return {
        title: "Změna priority",
        description: `Priorita byla změněna: ${oldPri} → ${newPri}.`,
      };
    }

    case "TASK_DUE_DATE_CHANGED": {
      const oldDate = prev?.dueDate;
      const newDate = next?.dueDate;
      if (!newDate && oldDate) {
        return {
          title: "Změna termínu",
          description: "Termín splnění byl odebrán.",
        };
      }
      if (newDate && !oldDate) {
        return {
          title: "Změna termínu",
          description: `Termín splnění byl nastaven na ${formatDateValue(newDate)}.`,
        };
      }
      return {
        title: "Změna termínu",
        description: `Termín byl změněn: ${formatDateValue(oldDate)} → ${formatDateValue(newDate)}.`,
      };
    }

    case "TASK_AREA_CHANGED": {
      const oldArea = prev?.areaId;
      const newArea = next?.areaId;
      if (!newArea && oldArea) {
        return {
          title: "Změna oblasti",
          description: "Úkol byl vyjmut z oblasti.",
        };
      }
      if (newArea && !oldArea) {
        return {
          title: "Změna oblasti",
          description: "Úkol byl zařazen do oblasti.",
        };
      }
      return {
        title: "Změna oblasti",
        description: "Oblast úkolu byla změněna.",
      };
    }

    case "TASK_ASSIGNEE_CHANGED": {
      const oldAssignee = prev?.assigneeId;
      const newAssignee = next?.assigneeId;
      if (!newAssignee && oldAssignee) {
        return {
          title: "Změna řešitele",
          description: "Přiřazení řešitele bylo zrušeno.",
        };
      }
      if (newAssignee && !oldAssignee) {
        return {
          title: "Přiřazení řešitele",
          description: "Úkol byl přiřazen řešiteli.",
        };
      }
      return {
        title: "Změna řešitele",
        description: "Řešitel úkolu byl změněn.",
      };
    }

    case "TASK_PARTICIPANT_ADDED": {
      return {
        title: "Přidání spoluřešitele",
        description: "Ke spolupráci na úkolu byl přidán další člen.",
      };
    }

    case "TASK_PARTICIPANT_REMOVED": {
      return {
        title: "Odebrání spoluřešitele",
        description: "Člen byl odebrán ze spoluřešitelů úkolu.",
      };
    }

    case "TASK_ARCHIVED": {
      return {
        title: "Archivace úkolu",
        description: "Úkol byl archivován.",
      };
    }

    case "TASK_DELETED": {
      const title = (prev?.title as string) || "";
      return {
        title: "Smazání úkolu",
        description: title ? `Úkol „${title}“ byl trvale smazán.` : "Úkol byl trvale smazán.",
      };
    }

    // ── Comments Domain ────────────────────────────────────────
    case "TASK_COMMENT_CREATED": {
      return {
        title: "Nový komentář",
        description: "Byl přidán nový komentář do diskuze.",
      };
    }

    case "TASK_COMMENT_EDITED": {
      return {
        title: "Úprava komentáře",
        description: "Komentář v diskuzi byl upraven.",
      };
    }

    case "TASK_COMMENT_DELETED": {
      return {
        title: "Smazání komentáře",
        description: "Komentář v diskuzi byl smazán.",
      };
    }

    default: {
      return {
        title: log.operation,
        description: "Záznam operace.",
      };
    }
  }
}
