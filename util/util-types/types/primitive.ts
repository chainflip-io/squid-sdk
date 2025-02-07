export type Bytes = string & {}
export type Bytes8 = string & {}
export type Bytes20 = string & {}
export type Bytes32 = string & {}

declare const emptyObjectSymbol: unique symbol;
export type EmptyObject = {[emptyObjectSymbol]?: never};