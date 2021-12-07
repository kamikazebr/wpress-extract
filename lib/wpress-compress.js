const fse = require("fs-extra");
const fs = require("fs");
const path = require("path");

const HEADER_SIZE = 4377; // length of the header
const HEADER_CHUNK_EOF = Buffer.alloc(HEADER_SIZE); // Empty header used for check if we reached the end

function isDirEmpty(dirname) {
  return fs.promises.readdir(dirname).then((files) => {
    return files.length === 0;
  });
}

function readFromBuffer(buffer, start, end) {
  const _buffer = buffer.slice(start, end);
  // Trim off the empty bytes
  return _buffer.slice(0, _buffer.indexOf(0x00)).toString();
}
function writeToBuffer(buffer, content, offset) {
  buffer.write(content, offset);
}
function writeToBufferHeader(headerBuffer, content, offset, end) {
  if (content.length < end - offset) {
    writeToBuffer(headerBuffer, content, offset);
  }
}

async function readHeader(fd) {
  const headerChunk = Buffer.alloc(HEADER_SIZE);
  await fd.read(headerChunk, 0, HEADER_SIZE, null);

  // Reached end of file
  if (Buffer.compare(headerChunk, HEADER_CHUNK_EOF) === 0) {
    return null;
  }

  const name = readFromBuffer(headerChunk, 0, 255);
  const size = parseInt(readFromBuffer(headerChunk, 255, 269), 10);
  const mTime = readFromBuffer(headerChunk, 269, 281);
  const prefix = readFromBuffer(headerChunk, 281, HEADER_SIZE);

  return {
    name,
    size,
    mTime,
    prefix,
  };
}

async function readBlockToFile(fd, header, outputPath) {
  const outputFilePath = path.join(outputPath, header.prefix, header.name);
  fse.ensureDirSync(path.dirname(outputFilePath));
  const outputStream = fs.createWriteStream(outputFilePath);

  let totalBytesToRead = header.size;
  while (true) {
    let bytesToRead = 512;
    if (bytesToRead > totalBytesToRead) {
      bytesToRead = totalBytesToRead;
    }

    if (bytesToRead === 0) {
      break;
    }

    const buffer = Buffer.alloc(bytesToRead);
    const data = await fd.read(buffer, 0, bytesToRead, null);
    outputStream.write(buffer);

    totalBytesToRead -= data.bytesRead;
  }

  outputStream.close();
}

// module.exports = async function wpExtract({
//   inputFile: _inputFile,
//   outputDir,
//   onStart,
//   onUpdate,
//   onFinish,
//   override,
// }) {
//   if (!fs.existsSync(_inputFile)) {
//     throw new Error(
//       `Input file at location "${_inputFile}" could not be found.`
//     );
//   }

//   if (override) {
//     // Ensure the output dir exists and is empty
//     fse.emptyDirSync(outputDir);
//   } else {
//     if (fs.existsSync(outputDir) && !(await isDirEmpty(outputDir))) {
//       throw new Error(
//         `Output dir is not empty. Clear it first or use the --force option to override it.`
//       );
//     }
//   }

//   const inputFileStat = fs.statSync(_inputFile);
//   const inputFile = await fs.promises.open(_inputFile, "r");

//   // Trigger onStart callback
//   onStart(inputFileStat.size);

//   let offset = 0;
//   let countFiles = 0;

//   while (true) {
//     const header = await readHeader(inputFile);
//     if (!header) {
//       break;
//     }

//     await readBlockToFile(inputFile, header, outputDir);
//     offset = offset + HEADER_SIZE + header.size;
//     countFiles++;

//     // Trigger onUpdate callback
//     onUpdate(offset);
//   }

//   await inputFile.close();

//   // Trigger onFinish callback
//   onFinish(countFiles);
// };

module.exports = function openFile(currentDir, pathFilename) {
  fullPathFilename = path.join(currentDir, pathFilename);
  console.log(fullPathFilename);
  const outputFilePath = path.join("test.wpress");
  fse.ensureDirSync(path.dirname(outputFilePath));
  let wpress_archive = fs.createWriteStream(outputFilePath);

  let fi = fs.statSync(fullPathFilename);
  // let fd = fs.openSync(pathFilename);
  let readStream = fs.createReadStream(fullPathFilename);
  readStream.on("open", (fd) => {
    console.log(fi.size);

    headerBuffer = Buffer.alloc(HEADER_SIZE);
    let time = fi.ctimeMs;
    writeToBufferHeader(headerBuffer, pathFilename, 0, 255);
    writeToBufferHeader(headerBuffer, fi.size + "", 255, 269);
    writeToBufferHeader(headerBuffer, time + "", 269, 281);
    writeToBufferHeader(headerBuffer, currentDir, 281, HEADER_SIZE);

    wpress_archive.write(headerBuffer, (err) => {
      if (err) console.log(err);
    });
    let chunk;
    while (null !== (chunk = readStream.read())) {
      console.log(chunk.length);
    }

    // readStream.pipe(wpress_archive);
  });
  // readStream.on("readable", () => {
  //   readStream.read(HEADER_SIZE);
  //   readStream.pipe(wpress_archive);
  // });

  readStream.on("end", () => {
    wpress_archive.close();
  });
};
