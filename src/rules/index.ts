import { Rule } from "../types";
import { n1QueryRule } from "./n1Query";
import { duplicateApiCallRule } from "./duplicateApiCall";
import { missingTimeoutRetryRule } from "./missingTimeoutRetry";
import { unboundedFetchRule } from "./unboundedFetch";
import { repeatedInternalActionRule } from "./repeatedInternalAction";

/**
 * Add new rules by dropping a file in this folder (implementing the `Rule`
 * interface from ../types) and listing it here. Nothing in the engine
 * needs to change.
 */
export const rules: Rule[] = [
  n1QueryRule,
  duplicateApiCallRule,
  missingTimeoutRetryRule,
  unboundedFetchRule,
  repeatedInternalActionRule,
];
