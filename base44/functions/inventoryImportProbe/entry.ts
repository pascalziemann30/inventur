import { PROBE_VALUE } from "../../src/lib/inventoryImportProbe.js";
import { scaledQuantity } from "../shared/inventory/quantities.js";

Deno.serve(async (req) => {
  return Response.json({
    srcImport: PROBE_VALUE,
    sharedImport: scaledQuantity("1.5") === 1500000n ? "shared-ok" : "shared-bad",
  });
});