import {
  Component,
  Input,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy
} from '@angular/core';

import { Observable, forkJoin, zip } from 'rxjs';

import { EntityStore, EntityStoreWatcher } from '@igo2/common';
import { Layer } from '../../layer/shared/layers/layer';
import { LayerService } from '../../layer/shared/layer.service';
import { IgoMap } from '../../map';

import {
  Catalog,
  CatalogItem,
  CatalogItemLayer,
  CatalogItemGroup,
  CatalogItemState,
  CatalogItemType
} from '../shared';
import { Research, SearchResult } from '../../search/shared/search.interfaces';
import { concatMap, map, filter, toArray } from 'rxjs/operators';
import { LayerOptions } from '../../layer/shared/layers/layer.interface';
import { WMSDataSourceOptions } from '../../datasource/shared/datasources/wms-datasource.interface';
import { SearchService } from '../../search/shared/search.service';
import { ObjectUtils } from '@igo2/utils';
import { generateIdFromSourceOptions } from '../../utils/id-generator';

/**
 * Component to browse a catalog's groups and layers and display them on a map.
 */
@Component({
  selector: 'igo-catalog-browser',
  templateUrl: './catalog-browser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogBrowserComponent implements OnInit, OnDestroy {
  /**
   * Catalog items store watcher
   */
  private watcher: EntityStoreWatcher<CatalogItem>;

  /**
   * Catalog
   */
  @Input() catalog: Catalog;

  /**
   * Store holding the catalog's items
   */
  @Input() store: EntityStore<CatalogItem, CatalogItemState>;

  /**
   * Map to add the catalog items to
   */
  @Input() map: IgoMap;

  /**
   * Whether a group can be toggled when it's collapsed
   */
  @Input() toggleCollapsedGroup: boolean = true;

  constructor(
    private layerService: LayerService,
    private cdRef: ChangeDetectorRef,
    private searchService: SearchService
  ) {}

  /**
   * @internal
   */
  ngOnInit() {
    const currentItems = this.map.layers.map((layer: Layer) => {
      return {
        id: layer.options.source.id,
        title: layer.title,
        type: CatalogItemType.Layer
      };
    });
    this.store.state.updateMany(currentItems, { added: true }, true);
    if (this.catalog && this.catalog.sortDirection !== undefined) {
      this.store.view.sort({
        direction: this.catalog.sortDirection,
        valueAccessor: (item: CatalogItem) => item.title
      });
    }
    this.watcher = new EntityStoreWatcher(this.store, this.cdRef);
  }

  ngOnDestroy() {
    this.watcher.destroy();
  }

  /**
   * @internal
   */
  isGroup(item: CatalogItem): boolean {
    return item.type === CatalogItemType.Group;
  }

  /**
   * @internal
   */
  isLayer(item: CatalogItem): boolean {
    return item.type === CatalogItemType.Layer;
  }

  /**
   * When a layer is added or removed, add or remove it from the map
   * @internal
   * @param event Layer added event
   */
  onLayerAddedChange(event: { added: boolean; layer: CatalogItemLayer }) {
    const layer = event.layer;
    this.store.state.update(layer, { added: event.added }, false);
    event.added ? this.addLayerToMap(layer) : this.removeLayerFromMap(layer);
  }

  /**
   * When a froup is added or removed, add or remove it from the map
   * @internal
   * @param event Group added event
   */
  onGroupAddedChange(event: { added: boolean; group: CatalogItemGroup }) {
    const group = event.group;
    this.store.state.update(group, { added: event.added }, false);
    event.added ? this.addGroupToMap(group) : this.removeGroupFromMap(group);
  }

  /**
   * Add layer to map
   * @param layer Catalog layer
   */
  private addLayerToMap(layer: CatalogItemLayer) {
    this.addLayersToMap([layer]);
  }

  /**
   * Remove layer from map
   * @param layer Catalog layer
   */
  private removeLayerFromMap(layer: CatalogItemLayer) {
    this.removeLayersFromMap([layer]);
  }


  private matchCatalogWmsLayerWithServiceLayer(addedLayerName, addedLayerUrl): Observable<any> {
    const wmsLayerType = 'wms'
    const layerDataType = 'Layer'

    const researches: Research[] = this.searchService.search(addedLayerName.slice(0,50), { searchType: 'Layer', getEnabledOnly: false });
    const requests$ = []
    researches.map((research: Research) => { requests$.push(research.request) })

    const res = zip(...requests$).pipe(
      map((results: SearchResult<LayerOptions>[][]) => {
        return [].concat.apply([], results)
        .filter((result: SearchResult<LayerOptions>) => result.data.sourceOptions.type === wmsLayerType)
        .filter((result: SearchResult<LayerOptions>) => result.meta.dataType === layerDataType)
        .filter((result: SearchResult<LayerOptions>) => (result.data.sourceOptions as WMSDataSourceOptions).url.indexOf(addedLayerUrl) !== -1)
        .filter((result: SearchResult<LayerOptions>) => (result.data.sourceOptions as WMSDataSourceOptions).params.layers === addedLayerName)
      }))

    return res;
  }


  /**
   * Add multiple layers to map
   * @param layers Catalog layers
   */
  private addLayersToMap(layers: CatalogItemLayer[]) {
    /*       const layers$ = layers.map((layer: CatalogItemLayer) => {
             return this.layerService.createAsyncLayer(layer.options);
           });*/
    layers.forEach((layer: CatalogItemLayer) => {
      const wmsDataSourceOptions = layer.options.sourceOptions as WMSDataSourceOptions;
      const addedLayerName = wmsDataSourceOptions.params.layers;
      const addedLayerUrl = wmsDataSourceOptions.url;

      this.matchCatalogWmsLayerWithServiceLayer(addedLayerName, addedLayerUrl).subscribe(val => {
        if (val.length > 0) {
         // layer.title = val[0].data.title;
         // layer.options.title = val[0].data.title;
          layer.options.sourceOptions = ObjectUtils.mergeDeep(layer.options.sourceOptions, val[0].data.sourceOptions || {});
          layer.options.id = generateIdFromSourceOptions(layer.options.sourceOptions);
        }
        this.layerService.createAsyncLayer(layer.options).subscribe(oLayer => {
          this.map.addLayer(oLayer);
          this.store.state.update(layer, { added: true });
        });

        /*  zip(...layers$).subscribe((oLayers: Layer[]) => {
            this.store.state.updateMany(layers, { added: true });
            this.map.addLayers(oLayers);
            })
           });*/
      })
    })
  }

  /**
   * Remove multiple layers from map
   * @param layers Catalog layers
   */
  private removeLayersFromMap(layers: CatalogItemLayer[]) {
    layers.forEach((layer: CatalogItemLayer) => {
      this.store.state.update(layer, { added: false });
      if (layer.options.baseLayer === true) {
        const oLayer = this.map.getLayerById(layer.options.id);
        if (oLayer !== undefined) {
          this.map.removeLayer(oLayer);
        }
      } else {
        const oLayer = this.map.getLayerById(layer.id);
        if (oLayer !== undefined) {
          this.map.removeLayer(oLayer);
        }
      }
    });
  }

  /**
   * Sort the layers by title. asc or desc.
   * @internal
   */
  private sortCatalogItemsByTitle(items: CatalogItem[], direction) {
    const returnItem = items.sort((a, b) => {
      const titleA = a.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const titleB = b.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (titleA < titleB) {
        return -1;
      }
      if (titleA > titleB) {
        return 1;
      }
      return 0;
    });
    switch (direction) {
      case 'asc':
        return returnItem;
      case 'desc':
        return returnItem.reverse();
      default:
        return items;
    }
  }

  /**
   * Add all the layers of a group to map
   * @param group Catalog group
   */
  private addGroupToMap(group: CatalogItemGroup) {
    let layers = group.items.filter((item: CatalogItem) => {
      const added = this.store.state.get(item).added || false;
      return this.isLayer(item) && added === false;
    });
    if (this.catalog && this.catalog.sortDirection !== undefined) {
      layers = this.sortCatalogItemsByTitle(layers, this.catalog.sortDirection);
  }
    this.addLayersToMap(layers.reverse() as CatalogItemLayer[]);
  }

  /**
   * Remove all the layers of a group from map
   * @param group Catalog group
   */
  private removeGroupFromMap(group: CatalogItemGroup) {
    const layers = group.items.filter((item: CatalogItem) => {
      const added = this.store.state.get(item).added || false;
      return this.isLayer(item) && added === true;
    });
    this.removeLayersFromMap(layers as CatalogItemLayer[]);
  }
}
