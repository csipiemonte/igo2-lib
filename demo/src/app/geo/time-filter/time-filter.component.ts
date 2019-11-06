import { Component } from '@angular/core';

import { LanguageService } from '@igo2/core';
import {
  IgoMap,
  DataSourceService,
  LayerService,
  TimeFilterableDataSourceOptions,
  TimeFilterType,
  TimeFilterStyle
} from '@igo2/geo';

@Component({
  selector: 'app-time-filter',
  templateUrl: './time-filter.component.html',
  styleUrls: ['./time-filter.component.scss']
})
export class AppTimeFilterComponent {
  public map = new IgoMap({
    controls: {
      attribution: {
        collapsed: true
      }
    }
  });

  public view = {
    center: [-73, 47.2],
    zoom: 7
  };

  constructor(
    private languageService: LanguageService,
    private dataSourceService: DataSourceService,
    private layerService: LayerService
  ) {
    this.dataSourceService
      .createAsyncDataSource({
        type: 'osm'
      })
      .subscribe(dataSource => {
        this.map.addLayer(
          this.layerService.createLayer({
            title: 'OSM',
            source: dataSource
          })
        );
      });

    const datasourceDateTime: TimeFilterableDataSourceOptions = {
        id: 'test1',
        type: 'wms',
        url: 'https://geoegl.msp.gouv.qc.ca/ws/igo_gouvouvert.fcgi',
        params: {
          layers: 'vg_observation_v_inondation_embacle_wmst',
          version: '1.3.0'
        },
        timeFilterable: true,
        timeFilter: {
          min: '2019-01-01',
          max: '2020-01-01',
          range: true,
          value: '2019-04-01 13:00/2019-04-05 19:00',
          type: TimeFilterType.DATETIME,
          style: TimeFilterStyle.CALENDAR
        }
      };

    const datasourceYear: TimeFilterableDataSourceOptions = {
      type: 'wms',
      id: 'test2',
      url: 'https://geoegl.msp.gouv.qc.ca/ws/igo_gouvouvert.fcgi',
      params: {
        layers: 'vg_observation_v_inondation_embacle_wmst',
        version: '1.3.0'
      },
      timeFilterable: true,
      timeFilter: {
        min: '2013',
        max: '2019',
        range: false,
        type: TimeFilterType.YEAR,
        style: TimeFilterStyle.SLIDER,
        step: 1,
        timeInterval: 2000
      }
    };

    this.dataSourceService
      .createAsyncDataSource(datasourceYear)
      .subscribe(dataSource => {
        this.map.addLayer(
          this.layerService.createLayer({
            title: 'Ice jam (Style: YEAR)',
            visible: true,
            source: dataSource
          })
        );
      });

    this.dataSourceService
      .createAsyncDataSource(datasourceDateTime)
      .subscribe(dataSource => {
        this.map.addLayer(
          this.layerService.createLayer({
            title: 'Ice jam (Style: Date Time)',
            visible: true,
            source: dataSource
          })
        );
      });
  }
}
