/**
 * Shared naming heuristics for spotting OutSystems-generated calls in
 * exported .NET code. These are deliberately broad substring/regex checks
 * rather than a semantic model - tune/extend them as you see more real
 * exports. Keeping them in one place makes that easy.
 */

// Calls that look like a database fetch/aggregate/entity action.
export const DB_CALL_RE =
  /\.(Query|List|Aggregate|GetById|GetList|GetAll|Fetch|Search|ExecuteQuery|ExecuteReader|ExecuteScalar)\s*\(|(?:RDBMSQueries?|DataProvider|CApplicationDataProvider)\w*\.\w+\s*\(|\bCall(?:Create|Update|Delete|Get)\w*\s*\(/;

// Names that suggest an external integration/API/web-service call.
export const INTEGRATION_NAME_RE =
  /(Integration|RestClient|SoapClient|WebReference|ExternalLibrary|ApiClient|HttpClient)/i;

// Instantiation of an HTTP-ish client.
export const HTTP_CLIENT_NEW_RE = /\bnew\s+(HttpClient|RestClient|WebRequest|HttpWebRequest|SoapClient)\s*\(/;

// Evidence that a timeout has been configured somewhere nearby.
export const TIMEOUT_CONFIG_RE = /\.Timeout\s*=|TimeoutMs|ConnectTimeout|ReadTimeout/i;

// Evidence of retry handling.
export const RETRY_RE = /\bPolly\b|RetryPolicy|\.Retry\(|for\s*\(\s*int\s+attempt|maxRetries|retryCount/i;

// Fetch/list calls with no visible paging/filter args.
export const UNBOUNDED_FETCH_RE =
  /\b(?:GetList|GetAll|List|Aggregate|Fetch|Search)\s*\(\s*\)|\bGetList\w*\s*\(\s*null\s*\)/;

// Presence of paging/filter keywords anywhere in a method - if absent near
// an unbounded-looking fetch, we treat the fetch as suspicious.
export const PAGING_HINT_RE = /\b(Top|MaxRecords|PageSize|Skip\s*\(|Take\s*\(|Limit|Filter|Where)\b/;

// Simple caching hints, used to avoid flagging repeated calls that are
// already being memoized/cached by the developer.
export const CACHE_HINT_RE = /\bCache\b|Memoiz|_cache|MemoryCache/i;
