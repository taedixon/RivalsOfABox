
import * as fs from "fs";
import * as os from "os";

const downloadsFolder = `${os.homedir()}/Downloads`;
const defaultFolder = `${os.homedir()}/AppData/Local/RivalsofAether`
    + `/workshop/izzy/scripts/attacks`;
const workshopFolder = process.argv[2] ?? defaultFolder;

const attackFiles = [
    "AT_JAB",
    "AT_FTILT",
    "AT_DTILT",
    "AT_UTILT",
    "AT_FSTRONG",
    "AT_DSTRONG",
    "AT_USTRONG",
    "AT_DATTACK",
    "AT_FAIR",
    "AT_BAIR",
    "AT_DAIR",
    "AT_UAIR",
    "AT_NAIR",
    "AT_FSPECIAL",
    "AT_DSPECIAL",
    "AT_USPECIAL",
    "AT_NSPECIAL",
    "AT_FSTRONG_2",
    "AT_DSTRONG_2",
    "AT_USTRONG_2",
    "AT_USPECIAL_GROUND",
    "AT_USPECIAL_2",
    "AT_FSPECIAL_2",
    "AT_FTHROW",
    "AT_UTHROW",
    "AT_DTHROW",
    "AT_NTHROW",
    "AT_DSPECIAL_2",
    "AT_EXTRA_1",
    "AT_DSPECIAL_AIR",
    "AT_NSPECIAL_2",
    "AT_FSPECIAL_AIR",
    "AT_TAUNT",
    "AT_TAUNT_2",
    "AT_EXTRA_2",
    "AT_EXTRA_3",
    "AT_NSPECIAL_AIR"
];

if (!fs.existsSync(downloadsFolder)) {
	throw new Error(`No folder exists at path ${downloadsFolder}`);
}

if (!fs.existsSync(workshopFolder)) {
	throw new Error(`No folder exists at path ${workshopFolder}`);
}

const debounceMap = new Map<string, number>();

const debounce = (filename: string) => {
    const existingTimer = debounceMap.get(filename);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    const newTimer = setTimeout(() => {
        debounceMap.delete(filename);
        onChange(filename), 300
    });
    debounceMap.set(filename, newTimer);
}

const onChange = async (filename: string) => {
	// taking a delicious WOMM shortcut here by assuming filename is gonna
	// be a valid value relative to the downloads folder
	const attack = attackFiles.find(name => filename.indexOf(name) === 0);
	if (attack) {
		console.log(`Detected change to ${attack}`);
		const src = `${downloadsFolder}/${filename}`;
		const jsonDst = `${workshopFolder}/${attack}.json`;
		const srcContents = fs.readFileSync(src);
		try {
			// read the gml
			const srcObj = JSON.parse(srcContents.toString("UTF-8"));
			const attackGml = srcObj.gml?.attack as string | undefined;

			if (attackGml) {
				// write gml to project directory
				const gmlName = attack.substr(3).toLowerCase();
				const gmlFile = `${workshopFolder}/${gmlName}.gml`
				console.log(`Writing GML to ${gmlFile}`);
				fs.writeFileSync(gmlFile, attackGml);
			}

			// copy the exported json file to the project directory since
			// we might like to keep it in github or something
			console.log(`Copying json to ${jsonDst}`);
			fs.writeFileSync(jsonDst, srcContents);

			// cleanup the file in Downloads
			console.log(`Removing ${src}`);
			fs.unlinkSync(src);
		} catch (err) {
			console.error(err);
        }
        console.log("done");
        console.log("================================================================")
	} else {
        console.error("somehow, attack was not");
    }
};

fs.watch(downloadsFolder, {persistent: true}, (event: string, filename?: string) => {
    console.log(event);
    console.log(filename);
	if (!filename) {
		throw new Error("AHHHHHHHHHHHHHHHHHHHHH FILENAME IS NOT AVAILABLE AHHHHHHHHHHHH");
	}
	const attack = attackFiles.find(name => filename.indexOf(name) === 0);
	if (attack && event === "change") {
        debounce(filename);
    }
});
console.log(`================================================================
Now watching ${downloadsFolder}
Outputting to ${workshopFolder}
================================================================`);