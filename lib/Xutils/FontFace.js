'use strict';

const ft2 = require("freetype2");
const fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);


function padWidth(buf, width) {
  var height = buf.length / width;
  if (width % 4 === 0) return buf;
  else {
    var stride = (width + 3) & ~3;
    var res = Buffer.alloc(height * stride);
    res.fill(0);
    for (var y = 0; y < height; ++y) {
      // memcpy(tmpbitmap+y*stride, bitmap->buffer+y*ginfo.width, ginfo.width);
      buf.copy(res, y * stride, y * width, y * width + width);
    }
    return res;
  }
}

function getFont(filepath, size, hdpi, vdpi){
  return readFile(filepath)
  .then(font_data => {
    const face = {};
    const charcode2glyph = [];
    let err = ft2.New_Memory_Face(font_data, 0, face);
    const fontface = face.face;
    if(err) throw err;
    err = ft2.Set_Char_Size(fontface, 0, 40 * size, hdpi, vdpi);
    if(err) throw err;

    const gindex = {};
    let charcode = ft2.Get_First_Char(face, gindex);
    while (gindex.gindex !== 0) {
      if (gindex.gindex > maxIndex) maxIndex = gindex.gindex;

      charcode = ft2.Get_Next_Char(face, charcode, gindex);
      charcode2glyph[charcode] = gindex.gindex;
      ft2.Load_Glyph(face, gindex.gindex, ft2.LOAD_RENDER);

      var gi = face.glyph;
      var b = gi.bitmap.buffer;
      var bb = gi.bitmap;

      var g = {
        id: gindex.gindex,
        charcode: charcode
      };
      if (b.length == 0) {
        g.empty = true;
        g.image = Buffer.alloc(64);
        g.image.fill(0);
        g.width = 8;
        g.height = 8;
        g.x = 0;
        g.y = 0;
        g.offX = 0;
        g.offY = 0;
        g.offX = gi.metrics.horiAdvance;
      } else {
        g.x = gi.bitmap_left;
        g.y = gi.bitmap_top;

        g.height = bb.rows;
        g.origWidth = bb.width;
        g.image = padWidth(b, bb.width);
        g.width = g.image.length / g.height;
        g.offX = gi.metrics.horiAdvance; // / 64;
        g.offY = 0;
      }
      glyphs.push(g);
    }
    return {fontface,glyphs,charcode2glyph};
  })
}

module.exports = {getFont};