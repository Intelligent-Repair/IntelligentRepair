import fs from "node:fs";
import path from "node:path";

function fail(msg: string): never {
    console.error(`❌ KB Validation Failed: ${msg}`);
    process.exit(1);
}

function warn(msg: string) {
    console.warn(`⚠️  KB Warning: ${msg}`);
}

function readJson(filePath: string): any {
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
    } catch (e: any) {
        fail(`Cannot read/parse JSON: ${filePath}. ${e?.message ?? e}`);
    }
}

function isNonEmptyString(v: any): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

function assert(cond: any, msg: string) {
    if (!cond) fail(msg);
}

function validateProbability(p: any, where: string) {
    assert(typeof p === "number" && Number.isFinite(p), `${where}: probability must be a number`);
    assert(p >= 0 && p <= 1, `${where}: probability must be between 0 and 1`);
}

function validateFirstQuestion(q: any, where: string) {
    assert(q && typeof q === "object", `${where}: missing first_question object`);
    assert(isNonEmptyString(q.text), `${where}: first_question.text is missing/empty`);
    assert(Array.isArray(q.options) && q.options.length > 0, `${where}: first_question.options must be non-empty array`);
    const ids = new Set<string>();
    for (const opt of q.options) {
        assert(opt && typeof opt === "object", `${where}: option is not an object`);
        assert(isNonEmptyString(opt.id), `${where}: option.id missing/empty`);
        assert(isNonEmptyString(opt.label), `${where}: option.label missing/empty`);
        if (ids.has(opt.id)) fail(`${where}: duplicate option.id "${opt.id}"`);
        ids.add(opt.id);
    }
}

function validateCauses(causes: any, where: string) {
    assert(Array.isArray(causes) && causes.length > 0, `${where}: causes must be non-empty array`);
    const causeIds = new Set<string>();
    for (const c of causes) {
        assert(c && typeof c === "object", `${where}: cause is not an object`);
        assert(isNonEmptyString(c.id), `${where}: cause.id missing/empty`);
        assert(isNonEmptyString(c.name), `${where}: cause.name missing/empty`);
        if (causeIds.has(c.id)) fail(`${where}: duplicate cause.id "${c.id}"`);
        causeIds.add(c.id);
        validateProbability(c.probability, `${where}: cause(${c.id})`);
        if (c.key_question) {
            assert(isNonEmptyString(c.key_question.text), `${where}: cause(${c.id}).key_question.text missing/empty`);
            assert(c.key_question.answers && typeof c.key_question.answers === "object", `${where}: cause(${c.id}).key_question.answers missing`);
        }
    }
}

function main() {
    const root = process.cwd();

    const warningLightsPath = path.join(root, "lib", "knowledge", "warning-lights.json");
    const carSymptomsPath = path.join(root, "lib", "knowledge", "car-symptoms.json");

    const warningLights = readJson(warningLightsPath);
    const carSymptoms = readJson(carSymptomsPath);

    assert(warningLights && typeof warningLights === "object", "warning-lights.json must be an object");
    assert(carSymptoms && typeof carSymptoms === "object", "car-symptoms.json must be an object");

    const lightIds = Object.keys(warningLights);
    assert(lightIds.length > 0, "warning-lights.json has no lights");

    for (const lightId of lightIds) {
        const light = warningLights[lightId];
        const where = `light(${lightId})`;

        assert(light && typeof light === "object", `${where}: must be an object`);
        assert(isNonEmptyString(light.severity), `${where}: severity missing/empty`);
        assert(light.names && typeof light.names === "object", `${where}: names missing`);
        validateFirstQuestion(light.first_question, `${where}`);

        if (light.scenarios) {
            assert(light.scenarios && typeof light.scenarios === "object", `${where}: scenarios must be an object`);
            for (const scenarioId of Object.keys(light.scenarios)) {
                const sc = light.scenarios[scenarioId];
                const sWhere = `${where}.scenario(${scenarioId})`;
                assert(sc && typeof sc === "object", `${sWhere}: must be an object`);
                assert(isNonEmptyString(sc.severity), `${sWhere}: severity missing/empty`);
                if (sc.causes) validateCauses(sc.causes, `${sWhere}`);
                if (Array.isArray(sc.self_fix_actions)) {
                    for (const act of sc.self_fix_actions) {
                        assert(isNonEmptyString(act.id), `${sWhere}: self_fix_actions[].id missing/empty`);
                        if (act.followup_question) {
                            validateFirstQuestion(act.followup_question, `${sWhere}.action(${act.id}).followup_question`);
                        }
                    }
                }
            }
        } else {
            warn(`${where}: has no scenarios (OK if intentional)`);
        }
    }

    // car-symptoms basic checks
    assert(Array.isArray(carSymptoms.symptoms), "car-symptoms.json: symptoms must be an array");
    for (const cat of carSymptoms.symptoms) {
        assert(isNonEmptyString(cat.category), "car-symptoms.json: symptoms[].category missing/empty");
        if (Array.isArray(cat.mappings)) {
            for (const m of cat.mappings) {
                assert(Array.isArray(m.keywords) && m.keywords.length > 0, "car-symptoms.json: mapping.keywords must be non-empty array");
                assert(isNonEmptyString(m.type), "car-symptoms.json: mapping.type missing/empty");
                assert(isNonEmptyString(m.targetId), "car-symptoms.json: mapping.targetId missing/empty");
            }
        }
    }

    console.log(`✅ KB Validation OK. Lights=${lightIds.length}`);
}

main();
