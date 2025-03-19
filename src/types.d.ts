/// <reference types="vite/client" />
/// <reference types="@types/leaflet" />

declare module 'react-leaflet' {
  import type { Map as LeafletMap, MapOptions, TileLayer as LeafletTileLayer } from 'leaflet';
  import type { ReactNode } from 'react';

  export interface MapContainerProps extends MapOptions {
    center: [number, number];
    zoom: number;
    children?: ReactNode;
    style?: React.CSSProperties;
    scrollWheelZoom?: boolean;
  }

  export interface TileLayerProps {
    url: string;
    attribution?: string;
  }

  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Marker: React.FC<any>;
  export const Popup: React.FC<any>;
} 