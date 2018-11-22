import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import $ from 'jquery';
import 'jquery-migrate';
import 'jquery-nearest';

import CardMenu from './CardMenu.jsx';
import CardCounters from './CardCounters.jsx';

import SquishableCardPanel from './SquishableCardPanel.jsx';

class Card extends React.Component {
    constructor() {
        super();

        this.onMouseOver = this.onMouseOver.bind(this);
        this.onMouseOut = this.onMouseOut.bind(this);
        this.onMenuItemClick = this.onMenuItemClick.bind(this);

        this.state = {
            showPopup: false,
            showMenu: false
        };

        this.shortNames = {
            damage: 'D',
            amber: 'A',
            stun: 'S',
            armor: 'R',
            power: 'P'
        };
    }

    onMouseOver(card) {
        if(this.props.onMouseOver) {
            this.props.onMouseOver(card);
        }
    }

    onMouseOut() {
        if(this.props.onMouseOut) {
            this.props.onMouseOut();
        }
    }

    onCardDragStart(event, card, source) {
        var dragData = { card: card, source: source };

        event.dataTransfer.setData('Text', JSON.stringify(dragData));
    }

    onTouchMove(event) {
        event.preventDefault();
        var touch = event.targetTouches[0];

        event.currentTarget.style.left = touch.screenX - 32 + 'px';
        event.currentTarget.style.top = touch.screenY - 42 + 'px';
        event.currentTarget.style.position = 'fixed';
    }

    getReactComponentFromDOMNode(dom) {
        for(var key in dom) {
            if(key.indexOf('__reactInternalInstance$') === 0) {
                var compInternals = dom[key]._currentElement;
                var compWrapper = compInternals._owner;
                var comp = compWrapper._instance;
                return comp;
            }
        }

        return null;
    }

    onTouchStart(event) {
        this.setState({ touchStart: $(event.currentTarget).offset() });
    }

    onTouchEnd(event) {
        var target = $(event.currentTarget);
        var nearestPile = target.nearest('.card-pile, .hand, .player-board');

        var pilePosition = nearestPile.offset();
        var cardPosition = target.offset();

        if(cardPosition.left === this.state.touchStart.left && cardPosition.top === this.state.touchStart.top) {
            return;
        }

        if(cardPosition.left + target.width() > pilePosition.left - 10 && cardPosition.left < pilePosition.left + nearestPile.width() + 10) {
            var dropTarget = '';

            if(_.includes(nearestPile.attr('class'), 'hand')) {
                dropTarget = 'hand';
            } else if(_.includes(nearestPile.attr('class'), 'player-board')) {
                dropTarget = 'play area';
            } else if(nearestPile.length > 0) {
                var component = this.getReactComponentFromDOMNode(nearestPile[0]);
                dropTarget = component.props.source;
            }

            if(dropTarget && this.props.onDragDrop) {
                this.props.onDragDrop(this.props.card, this.props.source, dropTarget);
            }
        }

        target.css({ left: this.state.touchStart.left + 'px', top: this.state.touchStart.top + 'px' });
        event.currentTarget.style.position = 'initial';
    }

    isAllowedMenuSource() {
        return this.props.source === 'play area';
    }

    onClick(event, card) {
        event.preventDefault();
        event.stopPropagation();

        if(!_.isEmpty(this.props.card.menu)) {
            this.setState({ showMenu: !this.state.showMenu });

            return;
        }

        if(this.props.card.showPopup) {
            this.setState({ showPopup: !this.state.showPopup });
            return;
        }

        if(this.props.onClick) {
            this.props.onClick(card);
        }
    }

    onMenuItemClick(menuItem) {
        if(this.props.onMenuItemClick) {
            this.props.onMenuItemClick(this.props.card, menuItem);
            this.setState({ showMenu: !this.state.showMenu });
        }
    }

    getCountersForCard(card) {
        var counters = {};

        _.each(card.tokens, (token, key) => {
            counters[key] = { count: token, fade: card.type === 'upgrade', shortName: this.shortNames[key] };
        });

        _.each(card.upgrades, upgrade => {
            _.extend(counters, this.getCountersForCard(upgrade));
        });

        var filteredCounters = _.omit(counters, counter => {
            return _.isUndefined(counter) || _.isNull(counter) || counter < 0;
        });

        if(card.stunned) {
            filteredCounters.stun = 0;
        }

        return filteredCounters;
    }

    getWrapper() {
        let wrapperClassName = '';
        let upgrades = this.props.source === 'play area' ? _.size(this.props.card.upgrades) : 0;
        if(upgrades > 0) {
            wrapperClassName = 'wrapper-' + upgrades.toString();
        }

        if(this.props.card.taunt && this.props.card.location === 'play area') {
            wrapperClassName += this.props.isMe ? ' mytaunt' : 'opptaunt';
        }

        return wrapperClassName;
    }

    getAttachments() {

        if(this.props.source !== 'play area') {
            return null;
        }

        var index = 1;
        var upgrades = _.map(this.props.card.upgrades, upgrade => {
            var returnedAttachment = (<Card key={ upgrade.uuid } source={ this.props.source } card={ upgrade }
                className={ 'upgrade upgrade-' + index } wrapped={ false }
                onMouseOver={ this.props.disableMouseOver ? null : this.onMouseOver.bind(this, upgrade) }
                onMouseOut={ this.props.disableMouseOver ? null : this.onMouseOut }
                onClick={ this.props.onClick }
                onMenuItemClick={ this.props.onMenuItemClick }
                onDragStart={ ev => this.onCardDragStart(ev, upgrade, this.props.source) }
                size={ this.props.size } />);

            index += 1;

            return returnedAttachment;
        });

        return upgrades;
    }

    renderUnderneathCards() {
        // TODO: Right now it is assumed that all cards in the childCards array
        // are being placed underneath the current card. In the future there may
        // be other types of cards in this array and it should be filtered.
        let underneathCards = this.props.card.childCards;
        if(!underneathCards || underneathCards.length === 0) {
            return;
        }

        let maxCards = 1 + (underneathCards.length - 1) / 6;

        return (
            <SquishableCardPanel
                cardSize={ this.props.size }
                cards={ underneathCards }
                className='underneath'
                maxCards={ maxCards }
                onCardClick={ this.props.onClick }
                onMouseOut={ this.props.onMouseOut }
                onMouseOver={ this.props.onMouseOver }
                source='purged' />);
    }

    getCardOrder() {
        if(!this.props.card.order) {
            return null;
        }

        return (<div className='card-order'>{ this.props.card.order }</div>);
    }

    showMenu() {
        /*
        if(!this.isAllowedMenuSource()) {
            return false;
        }*/

        if(!this.props.card.menu || !this.state.showMenu) {
            return false;
        }

        return true;
    }

    showCounters() {
        if(_.contains(['province 1','province 2','province 3','province 4','stronghold province'], this.props.source) && this.props.card.type === 'province') {
            return true;
        }

        if(this.props.source !== 'play area' && this.props.source !== 'faction' && this.props.source !== 'revealed plots') {
            return false;
        }

        if(this.props.card.facedown || this.props.card.type === 'upgrade') {
            return false;
        }

        return true;
    }

    isFacedown() {
        return this.props.card.facedown || !this.props.card.id;
    }

    isInPopup() {
        if(this.props.isInPopup) {
            return true;
        }
        return this.props.card.facedown || !this.props.card.id;
    }

    getCard() {
        var cardClass = 'card';
        var imageClass = 'card-image';
        var cardBack = 'cardback.jpg';

        if(!this.props.card) {
            return <div />;
        }

        if(this.props.size !== 'normal') {
            cardClass += ' ' + this.props.size;
            imageClass += ' ' + this.props.size;
        }

        /* No custom cards currently
        if(this.props.card.code && this.props.card.code.startsWith('custom')) {
            cardClass += ' custom-card';
        }
        */

        cardClass += ' card-type-' + this.props.card.type;

        if(this.props.orientation === 'bowed' || this.props.card.exhausted) {
            cardClass += ' horizontal';
            imageClass += ' vertical bowed';
        } else if(this.props.card.isBroken) {
            cardClass += ' vertical';
            imageClass += ' vertical broken';
        } else {
            cardClass += ' vertical';
            imageClass += ' vertical';
        }

        if(this.props.card.unselectable) {
            cardClass += ' unselectable';
        }

        if(this.props.card.selected) {
            cardClass += ' selected';
        } else if(this.props.card.selectable) {
            cardClass += ' selectable';
        } else if(this.props.card.inDanger) {
            cardClass += ' in-danger';
        } else if(this.props.card.saved) {
            cardClass += ' saved';
        } else if(this.props.card.inConflict) {
            cardClass += ' conflict';
        } else if(this.props.card.covert) {
            cardClass += ' covert';
        } else if(this.props.card.controlled) {
            cardClass += ' controlled';
        } else if(this.props.card.new) {
            cardClass += ' new';
        }

        if(this.props.className) {
            cardClass += ' ' + this.props.className;
        }

        cardBack = 'idbacks/cardback.jpg';

        return (
            <div className='card-frame' ref='cardFrame'
                onTouchMove={ ev => this.onTouchMove(ev) }
                onTouchEnd={ ev => this.onTouchEnd(ev) }
                onTouchStart={ ev => this.onTouchStart(ev) }>
                { this.getCardOrder() }
                <div className={ cardClass }
                    onMouseOver={ this.props.disableMouseOver ? null : this.onMouseOver.bind(this, this.props.card) }
                    onMouseOut={ this.props.disableMouseOver ? null : this.onMouseOut }
                    onClick={ ev => this.onClick(ev, this.props.card) }
                    onDragStart={ ev => this.onCardDragStart(ev, this.props.card, this.props.source) }
                    draggable>
                    <div>
                        <span className='card-name'>{ this.props.card.name + ' (' + this.props.card.printedHouse + ')' }</span>
                        <img className={ imageClass } src={ '/img/' + (!this.isFacedown() && this.props.card.image ? ('cards/' + this.props.card.image + '.jpg') : cardBack) } />
                    </div>
                    { this.showCounters() ? <CardCounters counters={ this.getCountersForCard(this.props.card) } /> : null }
                </div>
                { this.showMenu() ? <CardMenu menu={ this.props.card.menu } onMenuItemClick={ this.onMenuItemClick } /> : null }
                { this.getPopup() }
            </div>);
    }

    onCloseClick(event) {
        event.preventDefault();
        event.stopPropagation();

        this.setState({ showPopup: !this.state.showPopup });

        if(this.props.onCloseClick) {
            this.props.onCloseClick();
        }
    }

    onPopupCardClick(card) {
        this.setState({ showPopup: false });

        if(this.props.onClick) {
            this.props.onClick(card);
        }
    }

    onPopupMenuItemClick() {
        this.setState({ showPopup: false });

        if(this.props.onClick) {
            this.props.onClick(this.props.card);
        }
    }

    getPopup() {
        let popup = null;
        let cardIndex = 0;

        let cardList = _.map(this.props.card.upgrades, card => {
            let cardKey = cardIndex++;
            if(!this.props.isMe) {
                card = { facedown: true, isDynasty: card.isDynasty, isConflict: card.isConflict };
            } else {
                cardKey = card.uuid;
            }
            return (<Card key={ cardKey } card={ card } source={ this.props.source }
                disableMouseOver={ this.props.disableMouseOver || !this.props.isMe }
                onMouseOver={ this.props.onMouseOver }
                onMouseOut={ this.props.onMouseOut }
                onTouchMove={ this.props.onTouchMove }
                onClick={ this.onPopupCardClick.bind(this, card) }
                onDragDrop={ this.props.onDragDrop }
                orientation={ this.props.orientation === 'bowed' ? 'vertical' : this.props.orientation }
                size={ this.props.size } />);
        });

        if(!this.props.card.showPopup || !this.state.showPopup) {
            return null;
        }

        let popupClass = 'panel';
        let arrowClass = 'arrow lg';

        if(this.props.popupLocation === 'top') {
            popupClass += ' our-side';
            arrowClass += ' down';
        } else {
            arrowClass += ' up';
        }

        if(this.props.orientation === 'horizontal') {
            arrowClass = 'arrow lg left';
        }

        let linkIndex = 0;

        let popupMenu = (<div>{ [<a className='btn btn-default' key={ linkIndex++ } onClick={ () => this.onPopupMenuItemClick() }>Select Card</a>] }</div>);

        popup = (
            <div className='popup'>
                <div className='panel-title' onClick={ event => event.stopPropagation() }>
                    <span className='text-center'>{ this.props.title }</span>
                    <span className='pull-right'>
                        <a className='close-button glyphicon glyphicon-remove' onClick={ this.onCloseClick.bind(this) } />
                    </span>
                </div>
                <div className={ popupClass } onClick={ event => event.stopPropagation() }>
                    { popupMenu }
                    <div className='inner'>
                        { cardList }
                    </div>
                    <div className={ arrowClass } />
                </div>
            </div>);

        return popup;
    }

    render() {
        if(this.props.wrapped) {
            return (
                <div className={ 'card-wrapper ' + this.getWrapper() } style={ this.props.style }>
                    { this.getCard() }
                    { this.getAttachments() }
                    { this.renderUnderneathCards() }
                </div>);
        }

        return this.getCard();
    }
}

Card.displayName = 'Card';
Card.propTypes = {
    card: PropTypes.shape({
        attached: PropTypes.bool,
        upgrades: PropTypes.array,
        baseMilitarySkill: PropTypes.number,
        basePoliticalSkill: PropTypes.number,
        cardback: PropTypes.string,
        childCards: PropTypes.array,
        controlled: PropTypes.bool,
        controller: PropTypes.string,
        covert: PropTypes.bool,
        exhausted: PropTypes.bool,
        facedown: PropTypes.bool,
        id: PropTypes.string,
        image: PropTypes.string,
        inConflict: PropTypes.bool,
        inDanger: PropTypes.bool,
        isBroken: PropTypes.bool,
        isConflict: PropTypes.bool,
        isDynasty: PropTypes.bool,
        isDishonored: PropTypes.bool,
        isHonored: PropTypes.bool,
        isProvince: PropTypes.bool,
        isToken: PropTypes.bool,
        location: PropTypes.string,
        menu: PropTypes.array,
        militarySkill: PropTypes.number,
        name: PropTypes.string,
        new: PropTypes.bool,
        order: PropTypes.number,
        politicalSkill: PropTypes.number,
        popupMenuText: PropTypes.string,
        power: PropTypes.number,
        printedHouse: PropTypes.string,
        saved: PropTypes.bool,
        selectable: PropTypes.bool,
        selected: PropTypes.bool,
        showPopup: PropTypes.bool,
        strength: PropTypes.number,
        stunned: PropTypes.bool,
        taunt: PropTypes.bool,
        tokens: PropTypes.object,
        type: PropTypes.string,
        unselectable: PropTypes.bool,
        uuid: PropTypes.string
    }).isRequired,
    className: PropTypes.string,
    disableMouseOver: PropTypes.bool,
    isInPopup: PropTypes.bool,
    isMe: PropTypes.bool,
    onClick: PropTypes.func,
    onCloseClick: PropTypes.func,
    onDragDrop: PropTypes.func,
    onMenuItemClick: PropTypes.func,
    onMouseOut: PropTypes.func,
    onMouseOver: PropTypes.func,
    onTouchMove: PropTypes.func,
    orientation: PropTypes.oneOf(['horizontal', 'bowed', 'vertical']),
    popupLocation: PropTypes.string,
    size: PropTypes.string,
    source: PropTypes.oneOf(['archives', 'hand', 'discard', 'deck', 'purged', 'play area', 'upgrade']).isRequired,
    style: PropTypes.object,
    title: PropTypes.string,
    wrapped: PropTypes.bool
};
Card.defaultProps = {
    orientation: 'vertical',
    wrapped: true
};

export default Card;