import path from "path";

/**
 * OutSystems .NET exports are namespaced/foldered per module, e.g.
 * `OrderIntegrationModule/Actions/SyncOrderStatus.cs` with a matching
 * `namespace OrderIntegrationModule.Actions { ... }`. We prefer the
 * namespace's first segment when we can find one, and fall back to the
 * top-level folder name relative to the project root.
 */
export function deriveModuleName(relativeFilePath: string, source: string): string {
  const namespaceMatch = source.match(/namespace\s+([\w.]+)/);
  if (namespaceMatch) {
    return namespaceMatch[1].split(".")[0];
  }
  const firstSegment = relativeFilePath.split(path.sep)[0];
  return firstSegment || "UnknownModule";
}

/**
 * Screen/action name heuristic: prefer the first class name declared in
 * the file (OutSystems typically emits one class per screen/action), then
 * fall back to the file's base name.
 */
export function deriveScreenOrAction(relativeFilePath: string, source: string): string {
  const classMatch = source.match(/\bclass\s+([A-Za-z_]\w*)/);
  if (classMatch) return classMatch[1];
  return path.basename(relativeFilePath, path.extname(relativeFilePath));
}
