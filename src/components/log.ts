import { FUNCTIONS_CONFIG_MANIFEST } from "next/dist/shared/lib/constants";

let elm: HTMLDivElement;

// only support rgb, because browser will convert it to rgb and it
// become weird for comparison
const warnColor = "rgb(255, 191, 0)";
const logColor = "rgb(204, 204, 204)";
const errorColor = "rgb(255, 85, 85)";

if (typeof window !== "undefined") {
  window.console.log = (...args) =>
    printDebug(args.map(parseContentString).join(" "), logColor);
  window.console.warn = (...args) =>
    printDebug(args.map(parseContentString).join(" "), warnColor);
  window.console.error = (...args) =>
    printDebug(args.map(parseContentString).join(" "), errorColor);
}

const messageHistory: HTMLDivElement[] = [];

function parseContentString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (typeof content === "number" || typeof content === "bigint") {
    return `${content}`;
  }

  if (typeof content === "boolean") {
    return content ? "true" : "false";
  }
  if (typeof content === "undefined") {
    return "undefined";
  }

  return JSON.stringify(content as object);
}

const HIDE_TIMEOUT = 2000;
let hideTimeout: ReturnType<typeof setTimeout> | undefined;
let scrollToLatest = true;

function resetHideTimer() {
  // set a timer for timeout
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    elm.style.transform = "translateY(100%)";
    elm.style.pointerEvents = "none";
  }, HIDE_TIMEOUT);
  elm.style.transform = "translateY(0%)";
  elm.style.pointerEvents = "all";
}

export function printDebug(content: unknown, color = "rgb(244, 244, 244)") {
  if (elm === undefined) {
    elm = document.createElement("div");
    elm.style.position = "fixed";
    elm.style.bottom = "0px";
    elm.style.left = "0px";
    elm.style.right = "0px";
    elm.style.backgroundColor = "#121212";
    elm.style.color = "#FFF";
    elm.style.zIndex = "100000000000";
    elm.style.maxHeight = "8rem";
    elm.style.overflowY = "scroll";
    elm.style.fontFamily = "monospace";
    elm.style.fontSize = "12px";
    elm.style.borderTop = "1px solid #444";
    elm.style.transition = "transform .3s cubic-bezier(0.22, 1, 0.36, 1)";

    elm.addEventListener(
      "pointerdown",
      (e: PointerEvent) => {
        e.stopPropagation();
        clearTimeout(hideTimeout);
        scrollToLatest = false;
      },
      { capture: true },
    );
    window.addEventListener("pointerdown", () => {
      resetHideTimer();
    });
    const attemptToSnapToBotton = () => {
      const hasScrolledToBotton =
        Math.abs(elm.scrollHeight - elm.clientHeight - elm.scrollTop) <= 1;
      if (hasScrolledToBotton) {
        scrollToLatest = true;
      }
    };
    elm.addEventListener("scroll", attemptToSnapToBotton);
    elm.addEventListener("pointerout", attemptToSnapToBotton);

    document.body.appendChild(elm);
  }

  resetHideTimer();

  const contentString = parseContentString(content);

  const prevMessage = messageHistory[messageHistory.length - 1];
  if (
    messageHistory.length > 0 &&
    (prevMessage.children[0] as HTMLSpanElement).innerText === contentString
  ) {
    // same content as before, increment the message count
    const countElm = prevMessage.children[1] as HTMLSpanElement;
    const countNumber =
      countElm.innerHTML === "" ? 0 : parseInt(countElm.innerHTML);
    countElm.innerHTML = `${countNumber + 1}`;
    return;
  }

  const newMessage = document.createElement("div");
  Object.assign(newMessage.style, {
    paddingTop: "2px",
    paddingBottom: "2px",
    paddingLeft: "4px",
    paddingRight: "4px",
    borderTop: "1px solid #222",
    color: color,
    display: "flex",
  } as CSSStyleDeclaration);
  newMessage.innerHTML = `<span>${contentString}</span> <span class="count" style="margin-left:auto; opacity:.5;"></span>`;
  messageHistory.push(newMessage);

  elm.appendChild(newMessage);

  if (scrollToLatest) {
    newMessage.scrollIntoView();
  }
}
