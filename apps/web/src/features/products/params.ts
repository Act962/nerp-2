import { parseAsArrayOf, parseAsString } from "nuqs/server";

export const productParams = {
  sku: parseAsString.withDefault(""),
  category: parseAsArrayOf(parseAsString).withDefault([]),
  min_value: parseAsString.withDefault(""),
  max_value: parseAsString.withDefault(""),
  date_init: parseAsString.withDefault(""),
  date_end: parseAsString.withDefault(""),
};
