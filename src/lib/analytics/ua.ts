/**
 * Coarse device/browser/OS classifier from a User-Agent string. Hand-rolled
 * regex sniffing rather than a UA-parsing dependency, since only broad
 * categories are needed (mobile/tablet/desktop, common browser/OS names) —
 * the full UA string is never stored, only these derived categories.
 */
export function classifyUserAgent(ua: string | undefined): {
  deviceType: "mobile" | "tablet" | "desktop";
  browser: string | null;
  os: string | null;
} {
  const s = ua ?? "";

  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";
  if (/iPad|Tablet(?!.*Mobile)|Nexus 7|Nexus 10|Kindle|Silk/i.test(s)) {
    deviceType = "tablet";
  } else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(s)) {
    deviceType = "mobile";
  }

  let browser: string | null = null;
  if (/EdgA?\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/SamsungBrowser/i.test(s)) browser = "Samsung Internet";
  else if (/CriOS/i.test(s)) browser = "Chrome"; // Chrome on iOS
  else if (/FxiOS/i.test(s)) browser = "Firefox"; // Firefox on iOS
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/Chromium\//i.test(s)) browser = "Chromium";
  else if (/Safari\//i.test(s) && /Version\//i.test(s)) browser = "Safari";
  else if (/MSIE|Trident/i.test(s)) browser = "Internet Explorer";

  let os: string | null = null;
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Mac OS X/i.test(s) && !/iPhone|iPad|iPod/i.test(s)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/CrOS/i.test(s)) os = "ChromeOS";
  else if (/Linux/i.test(s)) os = "Linux";

  return { deviceType, browser, os };
}
