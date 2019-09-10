const execa = require('execa')
const path = require('path')
const waitOn = require('wait-on')
const kill = require('kill-port')
const fs = require('fs-extra')
const tmp = require('tmp')
const set = require('lodash/set')

const rootPath = path.join(__dirname, '../../')
const VERDACCIO_PORT = 4873
const LOCAL_REGISTRY = `http://localhost:${VERDACCIO_PORT}`
const REMOTE_REGISTRY = `https://registry.npmjs.org/`

const paths = {
  doczCore: path.join(rootPath, 'core/docz-core'),
  docz: path.join(rootPath, 'core/docz'),
  doczGatsbyTheme: path.join(rootPath, 'core/gatsby-theme-docz'),
  // doczUtils: '../../core/docz-utils',
  // rehypeDocz: '../../core/rehype-docz',
  // remarkDocz: '../../core/remark-docz',
}

const examples = {
  basic: {
    path: path.join(rootPath, 'examples/basic'),
    tmp: path.join(tmpPath, 'examples/basic'),
  },
  gatsby: {
    path: path.join(rootPath, 'examples/gatsby'),
    tmp: path.join(tmpPath, 'examples/gatsby'),
  },
}

const updatePackageJson = async (pathToSource, reducer = v => v) => {
  console.log(`Modifying package.json in ${pathToSource}`)
  const pathToPackageJson = path.join(`${pathToSource}`, 'package.json')
  await fs.copyFile(
    pathToPackageJson,
    path.join(`${pathToSource}`, 'package.backup.json')
  )
  const packageJson = await fs.readJson(pathToPackageJson)
  const newPackageJson = reducer(packageJson)
  await fs.writeJson(pathToPackageJson, newPackageJson, { spaces: 2 })
}

const revertPackageJson = async pathToSource => {
  const pathToPackageJson = path.join(`${pathToSource}`, 'package.json')
  const pathToBackup = path.join(`${pathToSource}`, 'package.backup.json')
  await fs.move(pathToBackup, pathToPackageJson)
}

const startLocalRegistry = async () => {
  console.log('Running npx verdaccio')
  runCommand(`npx verdaccio ${e2eTestsPath}/verdaccio.yaml`)
  console.log('Waiting for Verdaccio to boot')
  await waitOn({ resources: [LOCAL_REGISTRY] })
  await runCommand(`npm set registry ${LOCAL_REGISTRY}`)
  await runCommand(`yarn config set registry ${LOCAL_REGISTRY}`)
}

const stopLocalRegistry = async () => {
  await runCommand(`npm set registry ${REMOTE_REGISTRY}`)
  await runCommand(`yarn config set registry ${REMOTE_REGISTRY}`)
}

const e2eTestsPath = __dirname
const runCommand = (
  command,
  { cwd = rootPath, stdio = 'inherit', detached = false } = {
    cwd: rootPath,
    stdio: 'inherit',
    detached: false,
  }
) => {
  const [binary, ...rest] = command.split(' ')
  return execa(binary, rest, { cwd, stdio, detached })
}
const tmpPath = tmp.dirSync({ unsafeCleanup: true, mode: 0o100777 }).name

const setupTestProjects = async () => {}

const installNodeModules = async (packagePath, cacheKey = '') => {
  const cachePath = path.join(rootPath, `.e2e-tests-cache`, cacheKey)
  const freshModulesPath = path.join(packagePath, 'node_modules')
  const hasCache = await fs.pathExists(cachePath)
  if (hasCache) {
    console.log(
      `Using node_modules cache in ${cachePath} for node_modules of ${cacheKey}`,
      {
        cachePath,
        freshModulesPath,
      }
    )
    await fs.remove(freshModulesPath)
    await fs.copy(cachePath, freshModulesPath)
  } else {
    console.log(
      `Couldnt find node_modules cache at ${cachePath} for node_modules of  ${cacheKey}`
    )
    await runCommand(`yarn install`, { cwd: packagePath })
    await fs.copy(freshModulesPath, cachePath)
  }
}

const ci = async () => {
  // return
  console.log(`Preparing tmp examples dir.`)
  let PORT = 3000
  for (let exampleName in examples) {
    // await runCommand(`mkdir -p ${tmpPath}/examples/`)
    const example = examples[exampleName]
    await fs.ensureDir(`${tmpPath}/examples/${exampleName}`)

    // copy example to a new temp directory
    // await runCommand(`cp -r ${example.path} ${path.join(example.tmp, '..')}`)
    console.log()
    console.log(`Copying ${exampleName} example to a temporary directory.`)
    console.log(`Source : ${example.path}`)
    console.log(`Destination : ${example.tmp}`)
    console.log()

    await fs.copy(example.path, example.tmp)
    console.log(`Copied ${exampleName} example to a temporary directory.`)

    console.log(`Modifying package.json in ${example.tmp}`)
    const pathToPackageJson = path.join(`${example.tmp}`, 'package.json')
    const packageJson = await fs.readJson(pathToPackageJson)
    // set(packageJson, `dependencies.gatsby-theme-docz`, paths.doczGatsbyTheme)
    await fs.writeJson(pathToPackageJson, packageJson, { spaces: 2 })

    console.log(`Installing modules in tmp directory`)
    await installNodeModules(example.tmp, exampleName)

    // await runCommand(`yarn build`, example.tmp)
    const command = runCommand(`yarn dev --port ${PORT}`, { cwd: example.tmp })

    await waitOn({ resources: [`http://localhost:${PORT}`] })
    console.log('Ready. Starting e2e tests')

    await runCommand('yarn run testcafe:ci', { cwd: e2eTestsPath })
    command.kill('SIGTERM', {
      forceKillAfterTimeout: 2000,
    })
    await kill(3000, 'tcp')
  }
  await fs.remove(tmpPath)
  console.log('done')
  return
}
const setupLocalRegistry = async () => {
  await startLocalRegistry()
  console.log('DONE SETTING UP LOCAL REGISTRY')
  await updatePackageJson(paths.doczGatsbyTheme, packageJson => {
    const version = get(packageJson, 'version')
    const versionChunks = version.split('.')
    versionChunks[versionChunks.length - 1] = Date.now()
    newVersion = versionChunks.join('.')
    set(packageJson, 'version', newVersion)
    return packageJson
  })
  await runCommand(
    `npx npm-auth-to-token@1.0.0 -u user -p password -e user@example.com -r ${LOCAL_REGISTRY}`,
    { cwd: paths.doczGatsbyTheme }
  )
  await runCommand(`npm publish --tag ci`, { cwd: paths.doczGatsbyTheme })
  console.log('Published gatsby')
}

const publishPackages = async () => {}

setupLocalRegistry()
  .then(publishPackages)
  .then(ci)
  .then(() => {
    console.log('Exiting process')
    process.exit()
    console.log('Exited process')
  })
  .catch(err => {
    console.log('Error ', err)
    process.exit()
  })
// process
//   .on('SIGHUP', function() {
//     console.log('SIGHUP RECEIVED')
//   })
//   .on('error', () => {
//     process.kill(process.pid, 'SIGTERM')
//   })
//   .on('exit', function() {
//     process.kill(process.pid, 'SIGTERM')
//   })

// ;(async () => {
//   await ci()
//   console.log('Exited process')
// })()

// /var/folders/jn/3z685bls0mv64x4q1vjrzgy40000gn/T/tmp-546690gUnJPBhzg0U/examples/basic
