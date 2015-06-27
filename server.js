// TODO: Make proper queue so parallel requests don't clobber each other
import express from 'express'
import serveStatic from 'serve-static'
import makeDoxyfile from './make-doxyfile'
import {exec} from 'mz/child_process'
import fs from 'mz/fs'

async function ensurePaths () {
	await exec(`mkdir -p public`)
	await exec(`mkdir -p tmp`)
}

async function ensureRepo () {
	if (await fs.exists('repo')) return
	await exec('git clone https://github.com/nodejs/io.js.git repo')
}

async function ensureDocs (hash) {
	if (await fs.exists(`public/${hash}`)) return

	// Checkout commit by hash
	let path = `tmp/${hash}`
	await exec(`cp -R repo ${path}`)
	await exec(`git checkout ${hash}`, {
		cwd: path
	})

	// Add a Doxyfile and generate the docs
	let headers = ['include/v8.h']
	let destination = `../../../../public/${hash}`
	let doxyfile = makeDoxyfile(headers, destination)
	await fs.writeFile(`${path}/deps/v8/Doxyfile`, doxyfile)
	await exec('doxygen Doxyfile', {
		cwd: `${path}/deps/v8`
	})

	// Cleanup temporary checkout folder
	await exec(`rm -rf ${path}`)
}

ensurePaths().then(ensureRepo).then(() => {
	let app = express()

	app.use('/:hash/*', async function (req, res, next) {
		await ensureDocs(req.params.hash)
		next()
	})

	app.use(serveStatic('public'))

	app.listen(3000, () => console.log('app started'))
})
