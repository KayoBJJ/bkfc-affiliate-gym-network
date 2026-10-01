import { readFileSync } from "node:fs";
import { join } from "node:path";

// Literal paths allow Next.js to trace these files into the server deployment.
export function getReceivedEmailAttachments() {
  return [
    {
      filename: "bkfc-gym-network-header-1200x360.jpg",
      content: readFileSync(join(process.cwd(), "public/email/gym-network/bkfc-gym-network-header-1200x360.jpg")),
      contentId: "bkfc-gym-header",
    },
    {
      filename: "bkfc-logo-wide-240.png",
      content: readFileSync(join(process.cwd(), "public/email/gym-network/bkfc-logo-wide-240.png")),
      contentId: "bkfc-gym-logo",
    },
  ];
}
