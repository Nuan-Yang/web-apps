import React, { Component } from 'react';
import { Page, View, Navbar, NavLeft, NavRight, Link, Icon } from 'framework7-react';

// import EditOptions from '../view/edit/Edit';
import Settings from '../view/settings/Settings';
import CollaborationView from '../../../../common/mobile/lib/view/Collaboration.jsx'
import CellEditor from '../controller/CellEditor';

export default class MainPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            editOptionsVisible: false,
            settingsVisible: false,
            collaborationVisible: false,
        };
    }

    handleClickToOpenOptions = opts => {
        this.setState(state => {
            if ( opts == 'edit' )
                return {editOptionsVisible: true};
            else
            if ( opts == 'settings' )
                return {settingsVisible: true};
            else
            if ( opts == 'coauth' )
                return {collaborationVisible: true}
        });
    };

    handleOptionsViewClosed = opts => {
        (async () => {
            await 1 && this.setState(state => {
                if ( opts == 'edit' )
                    return {editOptionsVisible: false};
                else
                if ( opts == 'settings' )
                    return {settingsVisible: false};
                else
                if ( opts == 'coauth' )
                    return {collaborationVisible: false}
            })
        })();
    };

  render() {
      return (
          <Page name="home">
              {/*<CellEditor />*/}
              {/* Page content */}
              <View id="editor_sdk" />
            {/*{*/}
                {/*!this.state.editOptionsVisible ? null :*/}
                    {/*<EditOptions onclosed={this.handleOptionsViewClosed.bind(this, 'edit')} />*/}
            {/*}*/}
            {
                !this.state.settingsVisible ? null :
                    <Settings onclosed={this.handleOptionsViewClosed.bind(this, 'settings')} />
            }
            {
                !this.state.collaborationVisible ? null :
                    <CollaborationView onclosed={this.handleOptionsViewClosed.bind(this, 'coauth')} />
            }
          </Page>
      )
  }
};