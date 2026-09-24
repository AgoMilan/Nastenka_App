import { z } from "zod";

/**
 * Validační schéma pro přihlášení uživatele (Login).
 * Slouží jako UX pomoc na klientovi i autoritativní validace na serveru.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Zadejte prosím e-mail" })
    .trim()
    .min(1, "Zadejte prosím e-mail")
    .email("Zadejte platnou e-mailovou adresu"),
  password: z
    .string({ required_error: "Zadejte prosím heslo" })
    .min(1, "Zadejte prosím heslo"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validační schéma pro registraci nového uživatele (Register).
 * Striktně vynucuje minimální délku hesla dle Better Auth a shodu hesel.
 */
export const registerSchema = z
  .object({
    name: z
      .string({ required_error: "Zadejte prosím své jméno" })
      .trim()
      .min(1, "Jméno je povinné")
      .max(255, "Jméno může mít maximálně 255 znaků"),
    email: z
      .string({ required_error: "Zadejte prosím e-mail" })
      .trim()
      .min(1, "E-mail je povinný")
      .email("Zadejte platnou e-mailovou adresu")
      .max(255, "E-mail může mít maximálně 255 znaků"),
    password: z
      .string({ required_error: "Zadejte prosím heslo" })
      .min(8, "Heslo musí mít alespoň 8 znaků"),
    confirmPassword: z
      .string({ required_error: "Potvrzení hesla je povinné" })
      .min(1, "Potvrzení hesla je povinné"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hesla se neshodují",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
