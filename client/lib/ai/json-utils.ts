export function ensureJsonString(raw: string): string {
    const text = (raw || "").trim();
    if (!text) return "";

    // Strip code fences if model returned ```json ... ```
    if (text.startsWith("```")) {
        const lines = text.split("\n");
        lines.shift();
        if (lines.length && lines[lines.length - 1].trim().startsWith("```")) lines.pop();
        return lines.join("\n").trim();
    }

    // Try to extract first JSON object/array block
    const firstObj = text.indexOf("{");
    const lastObj = text.lastIndexOf("}");
    const firstArr = text.indexOf("[");
    const lastArr = text.lastIndexOf("]");

    const objOk = firstObj !== -1 && lastObj !== -1 && lastObj > firstObj;
    const arrOk = firstArr !== -1 && lastArr !== -1 && lastArr > firstArr;

    if (arrOk && (!objOk || firstArr < firstObj)) {
        return text.slice(firstArr, lastArr + 1).trim();
    }

    if (objOk) {
        return text.slice(firstObj, lastObj + 1).trim();
    }

    return text;
}

export function extractJSON<T = any>(text: string): T | null {
    if (!text || typeof text !== "string") return null;

    const cleaned = ensureJsonString(text);
    if (!cleaned) return null;

    try {
        return JSON.parse(cleaned) as T;
    } catch {
        return null;
    }
}
