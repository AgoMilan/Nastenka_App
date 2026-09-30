/**
 * Port (rozhraní) repozitáře pro osobní pořadí úkolů (UserTaskOrder).
 *
 * Invarianty (STEP 6 – Personal Ordering):
 * 1. Pořadí je striktně vázáno na konkrétního uživatele (userId) a nástěnku (boardId).
 * 2. Každý uživatel má pro daný úkol nejvýše jednu pozici.
 * 3. Nezávislost na ORM a persistenční technologii (ADR-009).
 */

export interface UserTaskOrderRecord {
  readonly id: string;
  readonly userId: string;
  readonly taskId: string;
  readonly boardId: string;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertUserTaskOrderData {
  readonly userId: string;
  readonly taskId: string;
  readonly boardId: string;
  readonly position: number;
}

export interface UserTaskOrderRepository {
  /**
   * Načte všechny uložené pozice úkolů pro daného uživatele a nástěnku.
   */
  findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<UserTaskOrderRecord[]>;

  /**
   * Načte záznamy o pořadí pro konkrétní úkol (pro všechny uživatele).
   */
  findByTaskId(taskId: string): Promise<UserTaskOrderRecord[]>;

  /**
   * Vloží nebo aktualizuje pozici jednoho úkolu pro daného uživatele.
   */
  upsertOrder(data: UpsertUserTaskOrderData): Promise<void>;

  /**
   * Dávkově vloží nebo aktualizuje pozice více úkolů v rámci jedné transakce.
   */
  upsertOrders(orders: UpsertUserTaskOrderData[]): Promise<void>;

  /**
   * Smaže všechny záznamy o pořadí pro daného uživatele na dané nástěnce (např. při opuštění).
   */
  deleteByBoardAndUser(boardId: string, userId: string): Promise<void>;

  /**
   * Smaže záznamy o pořadí pro smazaný úkol.
   */
  deleteByTaskId(taskId: string): Promise<void>;
}
