export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      throw new Error("Clipboard API is not available");
    }

    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (typeof document === "undefined") {
      return false;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "fixed";
    textArea.style.top = "-1000px";
    textArea.style.left = "-1000px";
    document.body.append(textArea);
    textArea.focus({ preventScroll: true });
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    try {
      return document.execCommand("copy");
    } finally {
      textArea.remove();
    }
  }
}
