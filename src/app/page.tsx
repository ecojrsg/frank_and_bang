// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Root landing redirect routing players straight to the login screen.
 */

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
