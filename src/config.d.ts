import { z } from "zod";
export declare const configSchema: z.ZodObject<{
    bot: z.ZodDefault<z.ZodObject<{
        token: z.ZodDefault<z.ZodString>;
        check_interval_minutes: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        token: string;
        check_interval_minutes: number;
    }, {
        token?: string | undefined;
        check_interval_minutes?: number | undefined;
    }>>;
    database: z.ZodDefault<z.ZodObject<{
        url: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    bot: {
        token: string;
        check_interval_minutes: number;
    };
    database: {
        url: string;
    };
}, {
    bot?: {
        token?: string | undefined;
        check_interval_minutes?: number | undefined;
    } | undefined;
    database?: {
        url?: string | undefined;
    } | undefined;
}>;
export type Config = z.infer<typeof configSchema>;
export declare function validateConfig(config: unknown): Config;
export declare function ensureConfig(configPath: string): Promise<Config>;
