// Js_of_ocaml runtime support
// http://www.ocsigen.org/js_of_ocaml/
// Copyright (C) 2014 Jérôme Vouillon, Hugo Heuzard, Andy Ray
// Laboratoire PPS - CNRS Université Paris Diderot
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, with linking exception;
// either version 2.1 of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
//
// Bigarray.
//
// - all bigarray types including Int64 and Complex.
// - fortran + c layouts
// - sub/slice/reshape
// - retain fast path for 1d array access

//Provides: caml_ba_init const
function caml_ba_init() {
  return 0;
}

//Provides: caml_ba_get_size
//Requires: caml_invalid_argument
function caml_ba_get_size(dims) {
  var n_dims = dims.length;
  var size = 1;
  for (var i = 0; i < n_dims; i++) {
    if (dims[i] < 0)
      caml_invalid_argument("Bigarray.create: negative dimension");
    size = size * dims[i];
  }
  return size;
}

//Provides: caml_ba_get_size_per_element
function caml_ba_get_size_per_element(kind){
  switch(kind){
  case 7: case 10: case 11: return 2;
  default: return 1;
  }
}

//Provides: caml_ba_create_buffer
//Requires: caml_ba_get_size_per_element
//Requires: caml_invalid_argument
function caml_ba_create_buffer(kind, size){
  var g = joo_global_object;
  var view;
  switch(kind){
  case 0:  view = g.Float32Array; break;
  case 1:  view = g.Float64Array; break;
  case 2:  view = g.Int8Array; break;
  case 3:  view = g.Uint8Array; break;
  case 4:  view = g.Int16Array; break;
  case 5:  view = g.Uint16Array; break;
  case 6:  view = g.Int32Array; break;
  case 7:  view = g.Int32Array; break;
  case 8:  view = g.Int32Array; break;
  case 9:  view = g.Int32Array; break;
  case 10: view = g.Float32Array; break;
  case 11: view = g.Float64Array; break;
  case 12: view = g.Uint8Array; break;
  }
  if (!view) caml_invalid_argument("Bigarray.create: unsupported kind");
  var data = new view(size * caml_ba_get_size_per_element(kind));
  return data;
}

//Provides: Ml_Bigarray
//Requires: caml_array_bound_error, caml_invalid_argument
function Ml_Bigarray (kind, layout, dims, buffer) {
  this.kind   = kind ;
  this.layout = layout;
  this.dims   = dims;
  this.data = buffer;
}

Ml_Bigarray.prototype.caml_custom = "_bigarray";

Ml_Bigarray.prototype.offset = function (arg) {
  var ofs = 0;
  if(typeof arg === "number") arg = [arg];
  if (! (arg instanceof Array)) caml_invalid_argument("bigarray.js: invalid offset");
  if (this.dims.length != arg.length)
    caml_invalid_argument("Bigarray.get/set: bad number of dimensions");
  if(this.layout == 0 /* c_layout */) {
    for (var i = 0; i < this.dims.length; i++) {
      if (arg[i] < 0 || arg[i] >= this.dims[i])
        caml_array_bound_error();
      ofs = (ofs * this.dims[i]) + arg[i];
    }
  } else {
    for (var i = this.dims.length - 1; i >= 0; i--) {
      if (arg[i] < 1 || arg[i] > this.dims[i]){
        caml_array_bound_error();
      }
      ofs = (ofs * this.dims[i]) + (arg[i] - 1);
    }
  }
  return ofs;
}

Ml_Bigarray.prototype.get = function (ofs) {
  switch(this.kind){
  case 7:
    // Int64
    var l = this.data[ofs * 2 + 0];
    var h = this.data[ofs * 2 + 1];
    return [
      255,
      l & 0xffffff,
      ((l >>> 24) & 0xff) | ((h & 0xffff) << 8),
      (h >>> 16) & 0xffff];
  case 10: case 11:
    // Complex32, Complex64
    var r = this.data[ofs * 2 + 0];
    var i = this.data[ofs * 2 + 1];
    return [254, r, i];
  default:
    return this.data[ofs]
  }
}

Ml_Bigarray.prototype.set = function (ofs,v) {
  switch(this.kind){
  case 7:
    // Int64
    this.data[ofs * 2 + 0] = v[1] | ((v[2] & 0xff) << 24);
    this.data[ofs * 2 + 1] = ((v[2] >>> 8) & 0xffff) | (v[3] << 16);
    break;
  case 10: case 11:
    // Complex32, Complex64
    this.data[ofs * 2 + 0] = v[1];
    this.data[ofs * 2 + 1] = v[2];
    break;
  default:
    this.data[ofs] = v;
    break;
  }
  return 0
}


Ml_Bigarray.prototype.fill = function (v) {
  switch(this.kind){
  case 7:
    // Int64
    var a = ((v[1]      )         ) | ((v[2] & 0xff) << 24);
    var b = ((v[2] >>> 8) & 0xffff) | ((v[3]       ) << 16);
    if(a == b){
      this.data.fill(a);
    }
    else {
      for(var i = 0; i<this.data.length; i++){
        this.data[i] = (i%2 == 0) ? a : b;
      }
    }
    break;
  case 10: case 11:
    // Complex32, Complex64
    var im = v[1];
    var re = v[2];
    if(im == re){
      this.data.fill(im);
    }
    else {
      for(var i = 0; i<this.data.length; i++){
        this.data[i] = (i%2 == 0) ? im : re;
      }
    }
    break;
  default:
    this.data.fill(v);
    break;
  }
}


Ml_Bigarray.prototype.compare = function (b, total) {
  if (this.layout != b.layout || this.kind != b.kind) {
    var k1 = this.kind | (this.layout << 8);
    var k2 =    b.kind | (b.layout << 8);
    return k2 - k1;
  }
  if (this.dims.length != b.dims.length) {
    return b.dims.length - this.dims.length;
  }
  for (var i = 0; i < this.dims.length; i++)
    if (this.dims[i] != b.dims[i])
      return (this.dims[i] < b.dims[i]) ? -1 : 1;
  switch (this.kind) {
  case 0:
  case 1:
  case 10:
  case 11:
    // Floats
    var x, y;
    for (var i = 0; i < this.data.length; i++) {
      x = this.data[i];
      y = b.data[i];
      if (x < y)
        return -1;
      if (x > y)
        return 1;
      if (x != y) {
        if (!total) return NaN;
        if (x == x) return 1;
        if (y == y) return -1;
      }
    }
    break;
  case 7:
    // Int64
    for (var i = 0; i < this.data.length; i+=2) {
      // Check highest bits first
      if (this.data[i+1] < b.data[i+1])
        return -1;
      if (this.data[i+1] > b.data[i+1])
        return 1;
      if (this.data[i] < b.data[i])
        return -1;
      if (this.data[i] > b.data[i])
        return 1;
    }
    break;
  case 2:
  case 3:
  case 4:
  case 5:
  case 6:
  case 8:
  case 9:
  case 12:
    for (var i = 0; i < this.data.length; i++) {
      if (this.data[i] < b.data[i])
        return -1;
      if (this.data[i] > b.data[i])
        return 1;
    }
    break;
  }
  return 0;
}

//Provides: Ml_Bigarray_c_1_1
//Requires: Ml_Bigarray, caml_array_bound_error, caml_invalid_argument
function Ml_Bigarray_c_1_1(kind, layout, dims, buffer) {
  this.kind   = kind ;
  this.layout = layout;
  this.dims   = dims;
  this.data   = buffer;
}

Ml_Bigarray_c_1_1.prototype = new Ml_Bigarray()
Ml_Bigarray_c_1_1.prototype.offset = function (arg) {
  if(typeof arg !== "number"){
    if((arg instanceof Array) && arg.length == 1)
      arg = arg[0];
    else caml_invalid_argument("Ml_Bigarray_c_1_1.offset");
  }
  if (arg < 0 || arg >= this.dims[0])
    caml_array_bound_error();
  return arg;
}

Ml_Bigarray_c_1_1.prototype.get = function (ofs) {
  return this.data[ofs];
}

Ml_Bigarray_c_1_1.prototype.set = function (ofs,v) {
  this.data[ofs] = v;
  return 0
}

Ml_Bigarray_c_1_1.prototype.fill = function (v) {
  this.data.fill(v);
  return 0
}

//Provides: caml_ba_create_unsafe
//Requires: Ml_Bigarray, Ml_Bigarray_c_1_1, caml_ba_get_size, caml_ba_get_size_per_element
//Requires: caml_invalid_argument
function caml_ba_create_unsafe(kind, layout, dims, data){
  var size_per_element = caml_ba_get_size_per_element(kind);
  if(caml_ba_get_size(dims) * size_per_element != data.length) {
    caml_invalid_argument("length doesn't match dims");
  }
  if(layout == 0 && // c_layout
     dims.length == 1 && // Array1
     size_per_element == 1) // 1-to-1 mapping
    return new Ml_Bigarray_c_1_1(kind, layout, dims, data);
  return new Ml_Bigarray(kind, layout, dims, data);

}


//Provides: caml_ba_create
//Requires: caml_js_from_array
//Requires: caml_ba_get_size, caml_ba_create_unsafe
//Requires: caml_ba_create_buffer
function caml_ba_create(kind, layout, dims_ml) {
  var dims = caml_js_from_array(dims_ml);
  var data = caml_ba_create_buffer(kind, caml_ba_get_size(dims));
  return caml_ba_create_unsafe(kind, layout, dims, data);
}

//Provides: caml_ba_change_layout
//Requires: caml_ba_create_unsafe
function caml_ba_change_layout(ba, layout) {
  if(ba.layout == layout) return ba;
  var new_dims = []
  for(var i = 0; i < ba.dims.length; i++) new_dims[i] = ba.dims[ba.dims.length - i - 1];
  return caml_ba_create_unsafe(ba.kind, layout, new_dims, ba.data);
}

//Provides: caml_ba_kind
function caml_ba_kind(ba) {
  return ba.kind;
}

//Provides: caml_ba_layout
function caml_ba_layout(ba) {
  return ba.layout;
}

//Provides: caml_ba_num_dims
function caml_ba_num_dims(ba) {
  return ba.dims.length;
}

//Provides: caml_ba_dim
//Requires: caml_invalid_argument
function caml_ba_dim(ba, i) {
  if (i < 0 || i >= ba.dims.length)
    caml_invalid_argument("Bigarray.dim");
  return ba.dims[i];
}

//Provides: caml_ba_dim_1
//Requires: caml_ba_dim
function caml_ba_dim_1(ba) {
  return caml_ba_dim(ba, 0);
}

//Provides: caml_ba_dim_2
//Requires: caml_ba_dim
function caml_ba_dim_2(ba) {
  return caml_ba_dim(ba, 1);
}

//Provides: caml_ba_dim_3
//Requires: caml_ba_dim
function caml_ba_dim_3(ba) {
  return caml_ba_dim(ba, 2);
}

//Provides: caml_ba_get_generic
//Requires: caml_js_from_array
function caml_ba_get_generic(ba, i) {
  var ofs = ba.offset(caml_js_from_array(i));
  return ba.get(ofs);
}

//Provides: caml_ba_uint8_get16
//Requires: caml_array_bound_error
function caml_ba_uint8_get16(ba, i0) {
  var ofs = ba.offset(i0);
  if(ofs + 1 >= ba.data.length) caml_array_bound_error();
  var b1 = ba.get(ofs);
  var b2 = ba.get(ofs + 1);
  return (b1 | (b2 << 8));
}

//Provides: caml_ba_uint8_get32
//Requires: caml_array_bound_error
function caml_ba_uint8_get32(ba, i0) {
  var ofs = ba.offset(i0);
  if(ofs + 3 >= ba.data.length) caml_array_bound_error();
  var b1 = ba.get(ofs+0);
  var b2 = ba.get(ofs+1);
  var b3 = ba.get(ofs+2);
  var b4 = ba.get(ofs+3);
  return ( (b1 << 0)  |
           (b2 << 8)  |
           (b3 << 16) |
           (b4 << 24) );
}

//Provides: caml_ba_uint8_get64
//Requires: caml_array_bound_error
function caml_ba_uint8_get64(ba, i0) {
  var ofs = ba.offset(i0);
  if(ofs + 7 >= ba.data.length) caml_array_bound_error();
  var b1 = ba.get(ofs+0);
  var b2 = ba.get(ofs+1);
  var b3 = ba.get(ofs+2);
  var b4 = ba.get(ofs+3);
  var b5 = ba.get(ofs+4);
  var b6 = ba.get(ofs+5);
  var b7 = ba.get(ofs+6);
  var b8 = ba.get(ofs+7);
  return [255,
          ((b1 << 0)  |
           (b2 << 8)  |
           (b3 << 16)),
          ((b4 << 0)  |
           (b5 << 8)  |
           (b6 << 16)),
          ((b7 << 0)  |
           (b8 << 8))];
}

//Provides: caml_ba_get_1
function caml_ba_get_1(ba, i0) {
  return ba.get(ba.offset(i0));
}

//Provides: caml_ba_get_2
function caml_ba_get_2(ba, i0, i1) {
  return ba.get(ba.offset([i0,i1]));
}

//Provides: caml_ba_get_3
function caml_ba_get_3(ba, i0, i1, i2) {
  return ba.get(ba.offset([i0,i1,i2]));
}

//Provides: caml_ba_set_generic
//Requires: caml_js_from_array
function caml_ba_set_generic(ba, i, v) {
  ba.set(ba.offset(caml_js_from_array(i)), v);
  return 0
}

//Provides: caml_ba_uint8_set16
//Requires: caml_array_bound_error
function caml_ba_uint8_set16(ba, i0, v) {
  var ofs = ba.offset(i0);
  if(ofs + 1 >= ba.data.length) caml_array_bound_error();
  ba.set(ofs+0,  v        & 0xff);
  ba.set(ofs+1, (v >>> 8) & 0xff);
  return 0;
}

//Provides: caml_ba_uint8_set32
//Requires: caml_array_bound_error
function caml_ba_uint8_set32(ba, i0, v) {
  var ofs = ba.offset(i0);
  if(ofs + 3 >= ba.data.length) caml_array_bound_error();
  ba.set(ofs+0,  v         & 0xff);
  ba.set(ofs+1, (v >>> 8)  & 0xff);
  ba.set(ofs+2, (v >>> 16) & 0xff);
  ba.set(ofs+3, (v >>> 24) & 0xff);
  return 0;
}

//Provides: caml_ba_uint8_set64
//Requires: caml_array_bound_error
function caml_ba_uint8_set64(ba, i0, v) {
  var ofs = ba.offset(i0);
  if(ofs + 7 >= ba.data.length) caml_array_bound_error();
  ba.set(ofs+0, (v[1])       & 0xff);
  ba.set(ofs+1, (v[1] >>  8) & 0xff);
  ba.set(ofs+2, (v[1] >> 16) & 0xff);
  ba.set(ofs+3, (v[2])       & 0xff);
  ba.set(ofs+4, (v[2] >>  8) & 0xff);
  ba.set(ofs+5, (v[2] >> 16) & 0xff);
  ba.set(ofs+6, (v[3])       & 0xff);
  ba.set(ofs+7, (v[3] >>  8) & 0xff);
  return 0;
}

//Provides: caml_ba_set_1
function caml_ba_set_1(ba, i0, v) {
  ba.set(ba.offset(i0), v);
  return 0
}

//Provides: caml_ba_set_2
function caml_ba_set_2(ba, i0, i1, v) {
  ba.set(ba.offset([i0,i1]), v);
  return 0;
}

//Provides: caml_ba_set_3
function caml_ba_set_3(ba, i0, i1, i2, v) {
  ba.set(ba.offset([i0,i1,i2]), v);
  return 0;
}

//Provides: caml_ba_fill
function caml_ba_fill(ba, v) {
  ba.fill(v);
  return 0;
}

//Provides: caml_ba_blit
//Requires: caml_invalid_argument
function caml_ba_blit(src, dst) {
  if (dst.dims.length != src.dims.length)
    caml_invalid_argument("Bigarray.blit: dimension mismatch");
  for (var i = 0; i < dst.dims.length; i++)
    if (dst.dims[i] != src.dims[i])
      caml_invalid_argument("Bigarray.blit: dimension mismatch");
  dst.data.set(src.data);
  return 0;
}

//Provides: caml_ba_sub
//Requires: caml_invalid_argument, caml_ba_create_unsafe, caml_ba_get_size
//Requires: caml_ba_get_size_per_element
function caml_ba_sub(ba, ofs, len) {
  var changed_dim;
  var mul = 1;
  if (ba.layout == 0) {
    for (var i = 1; i < ba.dims.length; i++)
      mul = mul * ba.dims[i];
    changed_dim = 0;
  } else {
    for (var i = 0; i < (ba.dims.length - 1); i++)
      mul = mul * ba.dims[i];
    changed_dim = ba.dims.length - 1;
    ofs = ofs - 1;
  }
  if (ofs < 0 || len < 0 || (ofs + len) > ba.dims[changed_dim]){
    caml_invalid_argument("Bigarray.sub: bad sub-array");
  }
  var new_dims = [];
  for (var i = 0; i < ba.dims.length; i++)
    new_dims[i] = ba.dims[i];
  new_dims[changed_dim] = len;
  mul *= caml_ba_get_size_per_element(ba.kind);
  var new_data = ba.data.subarray(ofs * mul, (ofs + len) * mul);
  return caml_ba_create_unsafe(ba.kind, ba.layout, new_dims, new_data);
}

//Provides: caml_ba_slice
//Requires: caml_js_from_array, caml_ba_create_unsafe, caml_invalid_argument, caml_ba_get_size
//Requires: caml_ba_get_size_per_element
function caml_ba_slice(ba, vind) {
  vind = caml_js_from_array(vind);
  var num_inds = vind.length;
  var index = [];
  var sub_dims = [];
  var ofs;

  if (num_inds > ba.dims.length)
    caml_invalid_argument("Bigarray.slice: too many indices");

  // Compute offset and check bounds
  if (ba.layout == 0) {
    for (var i = 0; i < num_inds; i++)
      index[i] = vind[i];
    for (; i < ba.dims.length; i++)
      index[i] = 0;
    sub_dims = ba.dims.slice(num_inds);
  } else {
    for (var i = 0; i < num_inds; i++)
      index[ba.dims.length - num_inds + i] = vind[i];
    for (var i = 0; i < ba.dims.length - num_inds; i++)
      index[i] = 1;
    sub_dims = ba.dims.slice(0, ba.dims.length - num_inds);
  }
  ofs = ba.offset(index);
  var size = caml_ba_get_size(sub_dims);
  var size_per_element = caml_ba_get_size_per_element(ba.kind);
  var new_data = ba.data.subarray(ofs * size_per_element, (ofs + size) * size_per_element);
  return caml_ba_create_unsafe(ba.kind, ba.layout, sub_dims, new_data);
}

//Provides: caml_ba_reshape
//Requires: caml_js_from_array, caml_invalid_argument, caml_ba_create_unsafe, caml_ba_get_size
function caml_ba_reshape(ba, vind) {
  vind = caml_js_from_array(vind);
  var new_dim = [];
  var num_dims = vind.length;

  if (num_dims < 0 || num_dims > 16){
    caml_invalid_argument("Bigarray.reshape: bad number of dimensions");
  }
  var num_elts = 1;
  for (var i = 0; i < num_dims; i++) {
    new_dim[i] = vind[i];
    if (new_dim[i] < 0)
      caml_invalid_argument("Bigarray.reshape: negative dimension");
    num_elts = num_elts * new_dim[i];
  }

  var size = caml_ba_get_size(ba.dims);
  // Check that sizes agree
  if (num_elts != size)
    caml_invalid_argument("Bigarray.reshape: size mismatch");
  return caml_ba_create_unsafe(ba.kind, ba.layout, new_dim, ba.data);
}

//Provides: caml_ba_serialize
//Requires: caml_int64_bits_of_float, caml_int64_to_bytes
//Requires: caml_int32_bits_of_float
function caml_ba_serialize(writer, ba, sz) {
  writer.write(32, ba.dims.length);
  writer.write(32, (ba.kind | (ba.layout << 8)));
  for(var i = 0; i < ba.dims.length; i++) writer.write(32,ba.dims[i]);
  switch(ba.kind){
  case 2:  //Int8Array
  case 3:  //Uint8Array
  case 12: //Uint8Array
    for(var i = 0; i < ba.data.length; i++){
      writer.write(8, ba.data[i]);
    }
    break;
  case 4:  // Int16Array
  case 5:  // Uint16Array
    for(var i = 0; i < ba.data.length; i++){
      writer.write(16, ba.data[i]);
    }
    break;
  case 6:  // Int32Array (int32)
    for(var i = 0; i < ba.data.length; i++){
      writer.write(32, ba.data[i]);
    }
    break;
  case 8:  // Int32Array (int)
  case 9:  // Int32Array (nativeint)
    writer.write(8,0);
    for(var i = 0; i < ba.data.length; i++){
      writer.write(32, ba.data[i]);
    }
    break;
  case 7:  // Int32Array (int64)
    for(var i = 0; i < ba.data.length / 2; i++){
      var b = caml_int64_to_bytes(ba.get(i));
      for (var j = 0; j < 8; j++) writer.write (8, b[j]);
    }
    break;
  case 1:  // Float64Array
    for(var i = 0; i < ba.data.length; i++){
      var b = caml_int64_to_bytes(caml_int64_bits_of_float(ba.get(i)));
      for (var j = 0; j < 8; j++) writer.write (8, b[j]);
    }
    break;
  case 0:  // Float32Array
    for(var i = 0; i < ba.data.length; i++){
      var b = caml_int32_bits_of_float(ba.get(i));
      writer.write(32, b);
    }
    break;
  case 10: // Float32Array (complex32)
    for(var i = 0; i < ba.data.length / 2; i++){
      var j = ba.get(i);
      writer.write(32, caml_int32_bits_of_float(j[1]));
      writer.write(32, caml_int32_bits_of_float(j[2]));
    }
    break;
  case 11: // Float64Array (complex64)
    for(var i = 0; i < ba.data.length / 2; i++){
      var complex = ba.get(i);
      var b = caml_int64_to_bytes(caml_int64_bits_of_float(complex[1]));
      for (var j = 0; j < 8; j++) writer.write (8, b[j]);
      var b = caml_int64_to_bytes(caml_int64_bits_of_float(complex[2]));
      for (var j = 0; j < 8; j++) writer.write (8, b[j]);
    }
    break;
  }
  sz[0] = (4 + ba.dims.length) * 4;
  sz[1] = (4 + ba.dims.length) * 8;
}

//Provides: caml_ba_deserialize
//Requires: caml_ba_create_unsafe, caml_failwith
//Requires: caml_ba_get_size
//Requires: caml_int64_of_bytes, caml_int64_float_of_bits
//Requires: caml_int32_float_of_bits
//Requires: caml_ba_create_buffer
function caml_ba_deserialize(reader, sz){
  var num_dims = reader.read32s();
  if (num_dims < 0 || num_dims > 16)
    caml_failwith("input_value: wrong number of bigarray dimensions");
  var tag = reader.read32s();
  var kind = tag & 0xff
  var layout = (tag >> 8) & 1;
  var dims = []
  for (var i = 0; i < num_dims; i++) dims.push(reader.read32u());
  var size = caml_ba_get_size(dims);
  var data = caml_ba_create_buffer(kind, size);
  var ba = caml_ba_create_unsafe(kind, layout, dims, data);
  switch(kind){
  case 2:  //Int8Array
    for(var i = 0; i < size; i++){
      data[i] = reader.read8s();
    }
    break;
  case 3:  //Uint8Array
  case 12: //Uint8Array
    for(var i = 0; i < size; i++){
      data[i] = reader.read8u();
    }
    break;
  case 4:  // Int16Array
    for(var i = 0; i < size; i++){
      data[i] = reader.read16s();
    }
    break;
  case 5:  // Uint16Array
    for(var i = 0; i < size; i++){
      data[i] = reader.read16u();
    }
    break;
  case 6:  // Int32Array (int32)
    for(var i = 0; i < size; i++){
      data[i] = reader.read32s();
    }
    break;
  case 8:  // Int32Array (int)
  case 9:  // Int32Array (nativeint)
    var sixty = reader.read8u();
    if(sixty) caml_failwith("input_value: cannot read bigarray with 64-bit OCaml ints");
    for(var i = 0; i < size; i++){
      data[i] = reader.read32s();
    }
    break;
  case 7: // (int64)
    var t = new Array(8);;
    for(var i = 0; i < size; i++){
      for (var j = 0;j < 8;j++) t[j] = reader.read8u();
      var int64 = caml_int64_of_bytes(t);
      ba.set(i,int64);
    }
    break;
  case 1:  // Float64Array
    var t = new Array(8);;
    for(var i = 0; i < size; i++){
      for (var j = 0;j < 8;j++) t[j] = reader.read8u();
      var f = caml_int64_float_of_bits(caml_int64_of_bytes(t));
      ba.set(i,f);
    }
    break;
  case 0:  // Float32Array
    for(var i = 0; i < size; i++){
      var f = caml_int32_float_of_bits(reader.read32s());
      ba.set(i,f);
    }
    break;
  case 10: // Float32Array (complex32)
    for(var i = 0; i < size; i++){
      var re = caml_int32_float_of_bits(reader.read32s());
      var im = caml_int32_float_of_bits(reader.read32s());
      ba.set(i,[254,re,im]);
    }
    break;
  case 11: // Float64Array (complex64)
    var t = new Array(8);;
    for(var i = 0; i < size; i++){
      for (var j = 0;j < 8;j++) t[j] = reader.read8u();
      var re = caml_int64_float_of_bits(caml_int64_of_bytes(t));
      for (var j = 0;j < 8;j++) t[j] = reader.read8u();
      var im = caml_int64_float_of_bits(caml_int64_of_bytes(t));
      ba.set(i,[254,re,im]);
    }
    break
  }
  sz[0] = (4 + num_dims) * 4;
  return caml_ba_create_unsafe(kind, layout, dims, data);
}

//Deprecated
//Provides: caml_ba_create_from
//Requires: caml_ba_create_unsafe, caml_invalid_argument, caml_ba_get_size_per_element
function caml_ba_create_from(data1, data2, jstyp, kind, layout, dims){
  if(data2 || caml_ba_get_size_per_element(kind) == 2){
    caml_invalid_argument("caml_ba_create_from: use return caml_ba_create_unsafe");
  }
  return caml_ba_create_unsafe(kind, layout, dims, data1);
}
