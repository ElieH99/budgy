/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as categories from "../categories.js";
import type * as expenseHelpers from "../expenseHelpers.js";
import type * as expenseManagerMutations from "../expenseManagerMutations.js";
import type * as expenseMutations from "../expenseMutations.js";
import type * as expenseQueries from "../expenseQueries.js";
import type * as expenses from "../expenses.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  categories: typeof categories;
  expenseHelpers: typeof expenseHelpers;
  expenseManagerMutations: typeof expenseManagerMutations;
  expenseMutations: typeof expenseMutations;
  expenseQueries: typeof expenseQueries;
  expenses: typeof expenses;
  files: typeof files;
  http: typeof http;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
