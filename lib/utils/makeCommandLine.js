'use strict';
const path = require("path");
const {URL} = require("url");
const {parse} = require("shell-quote");

/**
 * 
 * @param {string|Array<string>} files 
 * @param {string} line 
 * @returns {{exec:string, params:Array<string>}}
 */
module.exports = function makeCommandLine(files,line, args=""){
  if(!line){
    if(typeof files === "string"){
      return {exec:files,params:[]}
    }else{
      throw new Error("invalid execute request : "+files);
    }
  }
  /** 
   * @type {[string]} 
   * filter special shell operations returned by shell-quote
   * @see https://github.com/substack/node-shell-quote 
   * @ts-ignore */
  var argv = parse(line).filter(s=>typeof s === "string");
  var exec = argv.shift();
  var params = [];
  var has_files = false;
  files = ((Array.isArray(files))?files : [files]);
  function do_push_files(files){
    if(has_files) return;
    params.push(...files, ...parse(args).filter(s=>typeof s === "string"));
    has_files= true;
  }
  argv.forEach(function(arg){

    switch(arg){
      case "%f":
          do_push_files(files.slice(0,1));
        break;
      case "%F":
          do_push_files(files);
        break;
      case "%u":
        try{
          const uri = new URL(files[0]);
          do_push_files([uri.toString()]);
        }catch(e){
          //Only known error to URL is when input is not a valid absolute URL
          do_push_files([files[0]]);
        }
        break;
      case "%U":
        do_push_files(files.map(function(file){
          const uri = new URL(file, "file:");
          try{
            const uri = new URL(files[0]);
            return uri.toString();
          }catch(e){
            return file;
          }
        }));
        break;
      case "%i":
      case "%c":
      case "%k":
        //unsupported yet but known args
        break;
      default:
        //this arg is not a special flag but a regular argument
        //The spec advises to ignore unknown args completely
        if (! /^%[^%]/.test(arg)){
          params.push(arg);
        }
        break;
    }
  });
  return {exec:exec,params:params};
}
