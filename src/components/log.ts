let elm: HTMLDivElement;
let messageCount = 0;

export function printDebug(content: unknown) {
  if (elm === undefined) {
    elm = document.createElement("div");
    elm.style.position = "fixed";
    elm.style.bottom = "0px";
    elm.style.left = "0px";
    elm.style.right = "0px";
    elm.style.backgroundColor = "#000";
    elm.style.color = "#0F0";
    elm.style.zIndex = "100000000000";
    elm.style.maxHeight = "15vh";
    elm.style.overflowY = "scroll";

    document.body.appendChild(elm);
  }

  messageCount++;

  const newMessage = document.createElement("div");
  Object.assign(newMessage.style, {
    paddingTop: "2px",
    paddingBottom: "2px",
    paddingLeft: "4px",
    paddingRight: "4px",
    fontSize: "13px",
  } as CSSStyleDeclaration);
  newMessage.innerHTML = `<span style="opacity:.6">${messageCount}:</span> ${JSON.stringify(content as object)}`;

  elm.appendChild(newMessage);
  newMessage.scrollIntoView();
}
