

type ATOM = number;

interface XProperty{
  data: Buffer;
  type: number;
  bytesAfter: number;
}

interface XClientGeom{
  windowid: number;
  xPos: number;
  yPos: number;
  width: number;
  height: number;
  borderWidth :number;
  depth :number;
}

declare async function GetProperty(
  del: number,
  window: number,
  property: ATOM,
  type: ATOM,
  offset: number,
  length: number,
):Promise<XProperty>;

declare async function InternAtom(
  returnOnlyIfExist: boolean,
  value: string,
):Promise<number>;

declare async function GetGeometry(
  drawable: number,
):Promise<XClientGeom>;