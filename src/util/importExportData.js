export const strip = (toStrip, clone = true) => {
    const stripped = (clone) ? JSON.parse(JSON.stringify(toStrip)) : toStrip;

    if (Array.isArray(stripped)) {
        return stripped.map(val => strip(val, clone));
    }

    if (stripped.data) {
        for (const [key, val] of Object.entries(stripped.data)) {
            stripped.data[key] = val.value;
        }
    } else {
        for (const [key, val] of Object.entries(stripped)) {
            stripped[key] = val.value;
        }
    }

    return stripped;
}

export const populate = (stripped, fields, clone = true) => {

    const set_thing = (target) => {
        for (const [key, val] of Object.entries(target)) {
            if (!Object.keys(fields).includes(key)) {
                delete target[key];
                continue;
            }
            target[key] = {
                ...fields[key],
                value: val
            }
        }
        for (const key of Object.keys(fields)) {
            if (target[key] == undefined) {
                target[key] = Object.assign({}, fields[key]);
            }
        }
    }
    
    const populated = (clone) ? JSON.parse(JSON.stringify(stripped)) : stripped;
    if (Array.isArray(populated)) {
        for (const entry of populated) {
            populate(entry, fields, false);
        }
    } else if (populated.data) {
        set_thing(populated.data);
    } else {
        set_thing(populated);
    }
    return populated;
}