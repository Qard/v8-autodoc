// TODO: Make proper queue so parallel requests don't clobber each other
import express from 'express'
import serveStatic from 'serve-static'
import makeDoxyfile from './make-doxyfile'
import {exec} from 'mz/child_process'
import fs from 'mz/fs'

//
// Initial setup
//
async function ensurePaths () {
	await exec(`mkdir -p public`)
	await exec(`mkdir -p tmp`)
}

async function ensureRepo () {
	if (await fs.exists('repo')) return
	await exec('git clone https://github.com/nodejs/io.js.git repo')
}

//
// Generate requested docs
//
async function ensureDocs (hash) {
	if (await fs.exists(`public/${hash}`)) return

	// Create a temporary copy of the repo for this specific hash or tag
	let path = `tmp/${hash}`
	await exec(`cp -R repo ${path}`)

	// Checkout the appropriate commit
	try {
		await exec(`git checkout ${hash}`, {
			cwd: path
		})
	} catch (e) {
		console.error(e.stack)
		throw new Error('Invalid commit hash or tag')
	}

	try {
		// Add a Doxyfile and generate the docs
		let headers = ['include/v8.h']
		let destination = `../../../../public/${hash}`
		let doxyfile = makeDoxyfile(headers, destination)
		await fs.writeFile(`${path}/deps/v8/Doxyfile`, doxyfile)
		await exec('doxygen Doxyfile', {
			cwd: `${path}/deps/v8`
		})
	} catch (e) {
		console.error(e.stack)
		throw new Error('Unable to generate docs for that hash or tag')
	}

	// Cleanup temporary checkout folder
	await exec(`rm -rf ${path}`)
}

// This ensures parallel requests to same hash wait for a single promise
let queue = {}
async function queueDocGeneration (hash) {
	if (queue[hash]) {
		return queue[hash]
	} else {
		queue[hash] = ensureDocs(hash)
		return await queue[hash]
	}
}

async function main () {
	// Do some initial setup
	await ensurePaths()
	await ensureRepo()

	let app = express()

	// Generate static doc files for the given commit hash or tag
	app.use('/:hash/*', async function (req, res, next) {
		try {
			await queueDocGeneration(req.params.hash)
			next()
		} catch (e) {
			next(e)
		}
	})

	// Serve generated static files
	app.use(serveStatic('public'))

	// Error handling
	app.use(function (error, req, res, next) {
		res.status(500).send(errror.message)
	})

	app.listen(3000, () => console.log('app started'))
}

main()
