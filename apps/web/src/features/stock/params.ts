import { parseAsArrayOf, parseAsString } from "nuqs/server";

export const stockParams = {
  participant: parseAsArrayOf(parseAsString)
    .withDefault([])
    .withOptions({ clearOnDefault: true }),
};
