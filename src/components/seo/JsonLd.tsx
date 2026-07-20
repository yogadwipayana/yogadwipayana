type Schema = Record<string, unknown>;

/**
 * Renders schema.org structured data. `<` is escaped so a string inside the
 * payload can never break out of the script tag.
 */
export function JsonLd({ schema }: { schema: Schema | Schema[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
