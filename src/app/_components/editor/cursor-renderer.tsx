type CollaborationUser = {
    name: string;
    color: string;
    [key: string]: string;
};

// Custom cursor renderer for Google Docs-like appearance
export const renderCursor = (user: CollaborationUser): HTMLElement => {
    const cursorElement = document.createElement("span");
    cursorElement.classList.add("bn-collaboration-cursor__base");

    // Create the caret (vertical line)
    const caretElement = document.createElement("span");
    caretElement.setAttribute("contenteditable", "false");
    caretElement.classList.add("bn-collaboration-cursor__caret");
    caretElement.setAttribute(
        "style",
        `border-left: 2.5px solid ${user.color}; height: 1.25em; position: relative; display: inline-block; vertical-align: text-bottom;`
    );

    // Create the label
    const labelElement = document.createElement("span");
    labelElement.classList.add("bn-collaboration-cursor__label");
    labelElement.setAttribute(
        "style",
        `background-color: ${user.color}; color: #ffffff; padding: 3px 7px; font-size: 11px; font-weight: 600; border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 1px rgba(0, 0, 0, 0.15); position: absolute; left: -2.5px; top: -1.85em; white-space: nowrap; z-index: 10; pointer-events: none; user-select: none;`
    );
    labelElement.textContent = user.name;

    // Assemble the cursor
    caretElement.appendChild(labelElement);
    cursorElement.appendChild(document.createTextNode("\u2060")); // Non-breaking space
    cursorElement.appendChild(caretElement);
    cursorElement.appendChild(document.createTextNode("\u2060")); // Non-breaking space

    return cursorElement;
};

