/**
 * Porty a rozhraní pro modul membership.
 *
 * Invarianty (ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Poskytuje čisté doménové rozhraní pro členství.
 */

export type {
  BoardRole,
  MembershipRecord,
  CreateMembershipData,
  MembershipRepository,
} from "../../../boards/application/ports/membership-repository.port.ts";
