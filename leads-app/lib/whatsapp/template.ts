// Placeholder until a real template is approved by Meta. Update TEMPLATE_NAME/LANGUAGE_CODE once one exists — nothing else needs to change.

export const TEMPLATE_NAME = "seller_outreach_intro";
export const LANGUAGE_CODE = "en";

export function buildComponents(sellerName: string) {
  return [
    {
      type: "body",
      parameters: [{ type: "text", text: sellerName || "there" }],
    },
  ];
}