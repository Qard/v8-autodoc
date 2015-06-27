import ejs from 'ejs'
import fs from 'fs'

let contents = fs.readFileSync('Doxyfile.tmpl').toString()
let template = ejs.compile(contents)

export default function makeDoxyfile (files, destination) {
	if ( ! Array.isArray(files)) {
		files = [files]
	}

	return template({
		files: files.map((v) => `"${v}"`).join(' '),
		destination: destination
	})
}
