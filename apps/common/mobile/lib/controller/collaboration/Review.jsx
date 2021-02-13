import React, { Component } from 'react'
import Notifications from '../../../utils/notifications.js'
import {observer, inject} from "mobx-react"
import { withTranslation } from 'react-i18next';

import {PageReview, PageReviewChange} from "../../view/collaboration/Review";
import {LocalStorage} from "../../../utils/LocalStorage";

class InitReview extends Component {
    constructor(props){
        super(props);

        Common.Notifications.on('engineCreated', api => {
            api.asc_registerCallback('asc_onShowRevisionsChange', this.onChangeReview.bind(this));
        });

        Common.Notifications.on('document:ready', () => {
            const api = Common.EditorApi.get();
            const appOptions = props.storeAppOptions;
            api.asc_SetTrackRevisions(appOptions.isReviewOnly || LocalStorage.getBool("de-mobile-track-changes-" + (appOptions.fileKey || '')));
            // Init display mode
            if (!appOptions.canReview) {
                const canViewReview = appOptions.isEdit || api.asc_HaveRevisionsChanges(true);
                appOptions.setCanViewReview(canViewReview);
                if (canViewReview) {
                    let viewReviewMode = LocalStorage.getItem("de-view-review-mode");
                    if (viewReviewMode === null)
                        viewReviewMode = appOptions.customization && /^(original|final|markup)$/i.test(appOptions.customization.reviewDisplay) ? appOptions.customization.reviewDisplay.toLocaleLowerCase() : 'original';
                    viewReviewMode = (appOptions.isEdit || appOptions.isRestrictedEdit) ? 'markup' : viewReviewMode;
                    const displayMode = viewReviewMode.toLocaleLowerCase();
                    if (displayMode === 'final') {
                        api.asc_BeginViewModeInReview(true);
                    } else if (displayMode === 'original') {
                        api.asc_BeginViewModeInReview(false);
                    } else {
                        api.asc_EndViewModeInReview();
                    }
                    props.storeReview.changeDisplayMode(displayMode);
                }
            }
        });
    }

    onChangeReview (data) {
        const storeReview = this.props.storeReview;
        storeReview.changeArrReview(data);
    }

    render() {
        return null
    }
}

class Review extends Component {
    constructor(props) {
        super(props);
        this.onTrackChanges = this.onTrackChanges.bind(this);
        this.onDisplayMode = this.onDisplayMode.bind(this);

        this.appConfig = props.storeAppOptions;
        this.editorPrefix = window.editorType || '';

        let trackChanges = typeof this.appConfig.customization == 'object' ? this.appConfig.customization.trackChanges : undefined;
        trackChanges = this.appConfig.isReviewOnly || trackChanges === true || trackChanges !== false
            && LocalStorage.getBool(`${this.editorPrefix}-mobile-track-changes-${this.appConfig.fileKey || ''}`);

        this.state = {
            trackChanges: trackChanges
        }
    }

    onTrackChanges (checked) {
        const api = Common.EditorApi.get();
        if ( this.appConfig.isReviewOnly ) {
            this.setState({trackChanges: true});
        } else {
            this.setState({trackChanges: checked});
            api.asc_SetTrackRevisions(checked);
            LocalStorage.setBool(`${this.editorPrefix}-mobile-track-changes-${this.appConfig.fileKey || ''}`, checked);
        }
    }

    onAcceptAll () {
        const api = Common.EditorApi.get();
        api.asc_AcceptAllChanges();
    }

    onRejectAll () {
        const api = Common.EditorApi.get();
        api.asc_RejectAllChanges();
    }

    onDisplayMode (mode) {
        const api = Common.EditorApi.get();
        if (mode === 'final') {
            api.asc_BeginViewModeInReview(true);
        } else if (mode === 'original') {
            api.asc_BeginViewModeInReview(false);
        } else {
            api.asc_EndViewModeInReview();
        }
        !this.appConfig.canReview && LocalStorage.setItem("de-view-review-mode", mode);
        this.props.storeReview.changeDisplayMode(mode);
    }

    render() {
        const displayMode = this.props.storeReview.displayMode;
        const isReviewOnly = this.appConfig.isReviewOnly;
        const canReview = this.appConfig.canReview;
        const canUseReviewPermissions = this.appConfig.canUseReviewPermissions;
        const isRestrictedEdit = this.appConfig.isRestrictedEdit;
        return (
            <PageReview isReviewOnly={isReviewOnly}
                        canReview={canReview}
                        canUseReviewPermissions={canUseReviewPermissions}
                        isRestrictedEdit={isRestrictedEdit}
                        displayMode={displayMode}
                        trackChanges={this.state.trackChanges}
                        onTrackChanges={this.onTrackChanges}
                        onAcceptAll={this.onAcceptAll}
                        onRejectAll={this.onRejectAll}
                        onDisplayMode={this.onDisplayMode}
            />
        )
    }
}

class ReviewChange extends Component {
    constructor (props) {
        super(props);
        this.onAcceptCurrentChange = this.onAcceptCurrentChange.bind(this);
        this.onRejectCurrentChange = this.onRejectCurrentChange.bind(this);
        this.onGotoNextChange = this.onGotoNextChange.bind(this);
        this.onDeleteChange = this.onDeleteChange.bind(this);

        this.appConfig = props.storeAppOptions;

        if (this.appConfig && this.appConfig.canUseReviewPermissions) {
            const permissions = this.appConfig.customization.reviewPermissions;
            let arr = [];
            const groups  =  Common.Utils.UserInfoParser.getParsedGroups(Common.Utils.UserInfoParser.getCurrentName());
            groups && groups.forEach(function(group) {
                const item = permissions[group.trim()];
                item && (arr = arr.concat(item));
            });
            this.currentUserGroups = arr;
        }
    }
    intersection (arr1, arr2) { //Computes the list of values that are the intersection of all the arrays.
        const arr = [];
        arr1.forEach((item1) => {
            arr2.forEach((item2) => {
                if (item1 === item2) {
                    arr.push(item2);
                }
            });
        });
        return arr;
    }
    getInitials (name) {
        const fio = Common.Utils.UserInfoParser.getParsedName(name).split(' ');
        let initials = fio[0].substring(0, 1).toUpperCase();
        for (let i = fio.length-1; i>0; i--) {
            if (fio[i][0]!=='(' && fio[i][0]!==')') {
                initials += fio[i].substring(0, 1).toUpperCase();
                break;
            }
        }
        return initials;
    }
    checkUserGroups (username) {
        const groups = Common.Utils.UserInfoParser.getParsedGroups(username);
        return this.currentUserGroups && groups && (this.intersection(this.currentUserGroups, (groups.length>0) ? groups : [""]).length>0);
    }
    dateToLocaleTimeString (date) {
        const format = (date) => {
            let strTime,
                hours = date.getHours(),
                minutes = date.getMinutes(),
                ampm = hours >= 12 ? 'pm' : 'am';

            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0' + minutes : minutes;
            strTime = hours + ':' + minutes + ' ' + ampm;

            return strTime;
        };

        // MM/dd/yyyy hh:mm AM
        return (date.getMonth() + 1) + '/' + (date.getDate()) + '/' + date.getFullYear() + ' ' + format(date);
    }
    getArrChangeReview (data) {
        const api = Common.EditorApi.get();

        const { t } = this.props;
        const _t = t("Common.Collaboration", { returnObjects: true });

        if (data.length === 0) return [];
        const arr = [];
        const c_paragraphLinerule = {
            LINERULE_LEAST: 0,
            LINERULE_AUTO: 1,
            LINERULE_EXACT: 2
        };
        data.forEach((item) => {
            let changeText = [], proptext = '',
                value = item.get_Value(),
                movetype = item.get_MoveType();
            switch (item.get_Type()) {
                case Asc.c_oAscRevisionsChangeType.TextAdd:
                    changeText.push(<b key={'added_action_' + Asc.c_oAscRevisionsChangeType.TextAdd}>{_t.textInserted}</b>);
                    if (typeof value == 'object') {
                        value.forEach( (obj) => {
                            if (typeof obj === 'string')
                                changeText.push(<label key={'added_text_' + Asc.c_oAscRevisionsChangeType.TextAdd}> {Common.Utils.String.htmlEncode(obj)}</label>);
                            else {
                                switch (obj) {
                                    case 0:
                                        changeText.push(<label>&lt;{_t.textImage}&gt;</label>);
                                        break;
                                    case 1:
                                        changeText.push(<label>&lt;{_t.textShape}&gt;</label>);
                                        break;
                                    case 2:
                                        changeText.push(<label>&lt;{_t.textChart}&gt;</label>);
                                        break;
                                    case 3:
                                        changeText.push(<label>&lt;{_t.textEquation}&gt;</label>);
                                        break;
                                }
                            }
                        })
                    } else if (typeof value === 'string') {
                        changeText += (' ' + Common.Utils.String.htmlEncode(value));
                    }
                    break;
                case Asc.c_oAscRevisionsChangeType.TextRem:
                    changeText = (movetype === Asc.c_oAscRevisionsMove.NoMove) ? _t.textDeleted : (item.is_MovedDown() ? _t.textParaMoveFromDown : _t.textParaMoveFromUp);
                    if (typeof value == 'object') {
                        value.forEach( (obj) => {
                            if (typeof obj === 'string')
                                changeText += (' ' + Common.Utils.String.htmlEncode(obj));
                            else {
                                switch (obj) {
                                    case 0:
                                        changeText += (' &lt;' + _t.textImage + '&gt;');
                                        break;
                                    case 1:
                                        changeText += (' &lt;' + _t.textShape + '&gt;');
                                        break;
                                    case 2:
                                        changeText += (' &lt;' + _t.textChart + '&gt;');
                                        break;
                                    case 3:
                                        changeText += (' &lt;' + _t.textEquation + '&gt;');
                                        break;
                                }
                            }
                        })
                    } else if (typeof value === 'string') {
                        changeText += (' ' + Common.Utils.String.htmlEncode(value));
                    }
                    break;
                case Asc.c_oAscRevisionsChangeType.ParaAdd:
                    changeText = _t.textParaInserted;
                    break;
                case Asc.c_oAscRevisionsChangeType.ParaRem:
                    changeText = _t.textParaDeleted;
                    break;
                case Asc.c_oAscRevisionsChangeType.TextPr:
                    changeText = '<b>' + _t.textFormatted;
                    if (value.Get_Bold() !== undefined)
                        proptext += ((value.Get_Bold() ? '' : _t.textNot) + _t.textBold + ', ');
                    if (value.Get_Italic() !== undefined)
                        proptext += ((value.Get_Italic() ? '' : _t.textNot) + _t.textItalic + ', ');
                    if (value.Get_Underline() !== undefined)
                        proptext += ((value.Get_Underline() ? '' : _t.textNot) + _t.textUnderline + ', ');
                    if (value.Get_Strikeout() !== undefined)
                        proptext += ((value.Get_Strikeout() ? '' : _t.textNot) + _t.textStrikeout + ', ');
                    if (value.Get_DStrikeout() !== undefined)
                        proptext += ((value.Get_DStrikeout() ? '' : _t.textNot) + _t.textDStrikeout + ', ');
                    if (value.Get_Caps() !== undefined)
                        proptext += ((value.Get_Caps() ? '' : _t.textNot) + _t.textCaps + ', ');
                    if (value.Get_SmallCaps() !== undefined)
                        proptext += ((value.Get_SmallCaps() ? '' : _t.textNot) + _t.textSmallCaps + ', ');
                    if (value.Get_VertAlign() !== undefined)
                        proptext += (((value.Get_VertAlign() == 1) ? _t.textSuperScript : ((value.Get_VertAlign() == 2) ? _t.textSubScript : _t.textBaseline)) + ', ');
                    if (value.Get_Color() !== undefined)
                        proptext += (_t.textColor + ', ');
                    if (value.Get_Highlight() !== undefined)
                        proptext += (_t.textHighlight + ', ');
                    if (value.Get_Shd() !== undefined)
                        proptext += (_t.textShd + ', ');
                    if (value.Get_FontFamily() !== undefined)
                        proptext += (value.Get_FontFamily() + ', ');
                    if (value.Get_FontSize() !== undefined)
                        proptext += (value.Get_FontSize() + ', ');
                    if (value.Get_Spacing() !== undefined)
                        proptext += (_t.textSpacing + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_Spacing()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_Position() !== undefined)
                        proptext += (_t.textPosition + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_Position()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_Lang() !== undefined)
                        proptext += (Common.util.LanguageInfo.getLocalLanguageName(value.Get_Lang())[1] + ', ');

                    if (proptext.length > 0) {
                        changeText += ': ';
                        proptext = proptext.substring(0, proptext.length - 2);
                    }
                    changeText += '</b>';
                    changeText += proptext;
                    break;
                case Asc.c_oAscRevisionsChangeType.ParaPr:
                    if (value.Get_ContextualSpacing())
                        proptext += ((value.Get_ContextualSpacing() ? _t.textContextual : _t.textNoContextual) + ', ');
                    if (value.Get_IndLeft() !== undefined)
                        proptext += (_t.textIndentLeft + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_IndLeft()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_IndRight() !== undefined)
                        proptext += (_t.textIndentRight + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_IndRight()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_IndFirstLine() !== undefined)
                        proptext += (_t.textFirstLine + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_IndFirstLine()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_Jc() !== undefined) {
                        switch (value.Get_Jc()) {
                            case 0:
                                proptext += (_t.textRight + ', ');
                                break;
                            case 1:
                                proptext += (_t.textLeft + ', ');
                                break;
                            case 2:
                                proptext += (_t.textCenter + ', ');
                                break;
                            case 3:
                                proptext += (_t.textJustify + ', ');
                                break;

                        }
                    }
                    if (value.Get_KeepLines() !== undefined)
                        proptext += ((value.Get_KeepLines() ? _t.textKeepLines : _t.textNoKeepLines) + ', ');
                    if (value.Get_KeepNext())
                        proptext += ((value.Get_KeepNext() ? _t.textKeepNext : _t.textNoKeepNext) + ', ');
                    if (value.Get_PageBreakBefore())
                        proptext += ((value.Get_PageBreakBefore() ? _t.textBreakBefore : _t.textNoBreakBefore) + ', ');
                    if (value.Get_SpacingLineRule() !== undefined && value.Get_SpacingLine() !== undefined) {
                        proptext += _t.textLineSpacing;
                        proptext += (((value.Get_SpacingLineRule() == c_paragraphLinerule.LINERULE_LEAST) ? _t.textAtLeast : ((value.Get_SpacingLineRule() == c_paragraphLinerule.LINERULE_AUTO) ? _t.textMultiple : _t.textExact)) + ' ');
                        proptext += (((value.Get_SpacingLineRule() == c_paragraphLinerule.LINERULE_AUTO) ? value.Get_SpacingLine() : Common.Utils.Metric.fnRecalcFromMM(value.Get_SpacingLine()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName()) + ', ');
                    }
                    if (value.Get_SpacingBeforeAutoSpacing())
                        proptext += (_t.textSpacingBefore + ' ' + _t.textAuto + ', ');
                    else if (value.Get_SpacingBefore() !== undefined)
                        proptext += (_t.textSpacingBefore + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_SpacingBefore()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_SpacingAfterAutoSpacing())
                        proptext += (_t.textSpacingAfter + ' ' + _t.textAuto + ', ');
                    else if (value.Get_SpacingAfter() !== undefined)
                        proptext += (_t.textSpacingAfter + ' ' + Common.Utils.Metric.fnRecalcFromMM(value.Get_SpacingAfter()).toFixed(2) + ' ' + Common.Utils.Metric.getCurrentMetricName() + ', ');
                    if (value.Get_WidowControl())
                        proptext += ((value.Get_WidowControl() ? _t.textWidow : _t.textNoWidow) + ', ');
                    if (value.Get_Tabs() !== undefined)
                        proptext += (_t.textTabs + ', ');
                    if (value.Get_NumPr() !== undefined)
                        proptext += (_t.textNum + ', ');
                    if (value.Get_PStyle() !== undefined) {
                        const style = api.asc_GetStyleNameById(value.Get_PStyle());
                        if (style.length > 0) proptext += (style + ', ');
                    }

                    if (proptext.length > 0) {
                        proptext = proptext.substring(0, proptext.length - 2);
                    }
                    changeText = `<b><b>${_t.textParaFormatted}</b>${proptext.length ? ': ' : ''}</b>${proptext}`;
                    break;
                case Asc.c_oAscRevisionsChangeType.TablePr:
                    changeText = _t.textTableChanged;
                    break;
                case Asc.c_oAscRevisionsChangeType.RowsAdd:
                    changeText = _t.textTableRowsAdd;
                    break;
                case Asc.c_oAscRevisionsChangeType.RowsRem:
                    changeText = _t.textTableRowsDel;
                    break;

            }
            let date = (item.get_DateTime() == '') ? new Date() : new Date(item.get_DateTime());
            const user = item.get_UserName();
            const userColor = item.get_UserColor();
            const goto = (item.get_MoveType() == Asc.c_oAscRevisionsMove.MoveTo || item.get_MoveType() == Asc.c_oAscRevisionsMove.MoveFrom);
            date = this.dateToLocaleTimeString(date);
            const editable = this.appConfig.isReviewOnly && (item.get_UserId() == this.appConfig.user.id) || !this.appConfig.isReviewOnly && (!this.appConfig.canUseReviewPermissions || this.checkUserGroups(item.get_UserName()));
            arr.push({date: date, user: user, userColor: userColor, changeText: changeText, goto: goto, editable: editable});
        });
        return arr;
    }

    onPrevChange () {
        const api = Common.EditorApi.get();
        api.asc_GetPrevRevisionsChange();
    }

    onNextChange () {
        const api = Common.EditorApi.get();
        api.asc_GetNextRevisionsChange();
    }

    onAcceptCurrentChange () {
        const api = Common.EditorApi.get();
        api.asc_AcceptChanges(this.dataChanges[0]);
        setTimeout(() => {
            api.asc_GetNextRevisionsChange();
        });
    }

    onRejectCurrentChange () {
        const api = Common.EditorApi.get();
        api.asc_RejectChanges(this.dataChanges[0]);
        setTimeout(() => {
            api.asc_GetNextRevisionsChange();
        });
    }

    onGotoNextChange () {
        const api = Common.EditorApi.get();
        api.asc_FollowRevisionMove(this.dataChanges[0]);
    }

    onDeleteChange () {
        const api = Common.EditorApi.get();
        api.asc_RejectChanges(this.dataChanges[0]);
    }

    render() {
        this.dataChanges = this.props.storeReview.dataChanges;
        const arrChangeReview = this.getArrChangeReview(this.dataChanges);
        let change;
        let goto = false;
        if (arrChangeReview.length > 0) {
            change = {
                date: arrChangeReview[0].date,
                user: arrChangeReview[0].user,
                userName: Common.Utils.String.htmlEncode(Common.Utils.UserInfoParser.getParsedName(arrChangeReview[0].user)),
                color: arrChangeReview[0].userColor.get_hex(),
                text: arrChangeReview[0].changeText,
                initials: this.getInitials(arrChangeReview[0].user),
                editable: arrChangeReview[0].editable
            };
            goto = arrChangeReview[0].goto;
        }

        const isReviewOnly = this.appConfig.isReviewOnly;
        const canReview = this.appConfig.canReview;
        const displayMode = this.props.storeReview.displayMode;

        return (
            <PageReviewChange change={change}
                              goto={goto}
                              isReviewOnly={isReviewOnly}
                              canReview={canReview}
                              displayMode={displayMode}
                              onPrevChange={this.onPrevChange}
                              onNextChange={this.onNextChange}
                              onAcceptCurrentChange={this.onAcceptCurrentChange}
                              onRejectCurrentChange={this.onRejectCurrentChange}
                              onGotoNextChange={this.onGotoNextChange}
                              onDeleteChange={this.onDeleteChange}
            />
        )
    }
}


const InitReviewController = inject("storeAppOptions", "storeReview")(observer(InitReview));
const ReviewController = inject("storeAppOptions", "storeReview")(observer(Review));
const ReviewChangeController = withTranslation()(inject("storeAppOptions", "storeReview")(observer(ReviewChange)));

export {InitReviewController, ReviewController, ReviewChangeController};