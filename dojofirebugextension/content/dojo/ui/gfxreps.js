/* Released under BSD license (see license.txt) */


/**
 * dojo GFX specific Reps.
 * @author patricioreyna
 */
define([
        "firebug/chrome/reps",
        "firebug/firebug",
        "firebug/lib/css",
        "firebug/lib/dom",
        "firebug/lib/domplate",
        "firebug/lib/events",
        "firebug/lib/lib",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojoaccess",
        "dojo/core/prefs",
        "dojo/lib/collections",
        "dojo/ui/ui"
       ], function gfxRepsFactory(FirebugReps, Firebug, Css, Dom, Domplate, Events, FBL, Obj, FBTrace, DojoAccess, DojoPrefs, Collections, UI)
{
with(Domplate) {

var GfxReps = {};

//****************************************************************
// GENERAL FUNCTIONS
//****************************************************************

var getRep = function(value) {
        var rep = Firebug.getRep(value);
        var tag = rep.shortTag || rep.tag;
        return tag;
    };

var onContainerClick = function(event){
    if (!Events.isLeftClick(event)) {
      return;
    }

    var container = Dom.getAncestorByClass(event.target, "collapsable-container");
    this.toggleContainer(container);
};

var toggleContainer = function(container){
    if (Css.hasClass(container, "container-collapsed"))
    {
        Css.removeClass(container, "container-collapsed");
        Css.setClass(container, "container-opened");
    } else {
        Css.removeClass(container, "container-opened");
        Css.setClass(container, "container-collapsed");
    }
};


//****************************************************************
// REPS
//****************************************************************


//************************************************************************************************
//Rep used to visually represent Shapes across Firebug
GfxReps.ShapeRep = domplate(FirebugReps.Obj,
{
    tag: FirebugReps.OBJECTLINK(
        SPAN({"class":"dojo-gfxshape dojo-tracked-obj $object|getDetachedClassName", _referencedObject: "$object"},
            '[',
            SPAN({"class": "widgetId"}, "$object|getShapeType"),
            SPAN({"class": "widgetDeclaredClass"}, "$object|getShapeTitleProperties"),
            ']'
        )
    ),
        
    shortTag: FirebugReps.OBJECTLINK(
        SPAN({"class":"dojo-gfxshape dojo-tracked-obj $object|getDetachedClassName", _referencedObject: "$object"},
            '[',
            SPAN({"class": "widgetId"}, "$object|getShapeType"),
            SPAN({"class": "widgetDeclaredClass"}, "$object|getShapeTitleProperties"),
            ']'
        )
    ),
    
    inspectable: true,
    customInspectHighlightStroke: { "color":"blue", "width": 4 },

    /**
     * returns true if the given shape is NOT attached to the page document
     * (i.e. it wasn't appended to page yet)
     * @return boolean
     */
      //FIXME don't know if this is gonna work... (ie Silverlight objects don't have DOM nodes as rawNodes)
    /*boolean*/isDetached: function(shape) {
        return false;
        // //FIXME should use the dojoAccessor version of this method.
        // var domNode = shape.rawNode;
        // if(!domNode || !domNode.ownerDocument) {
        //     return true;
        // }
        // return !FBL.isAncestor(domNode, domNode.ownerDocument);
    },
    
    /*string*/getShapeType: function(shape) {
        return shape.declaredClass;
    },

    /*string*/getShapeTitleProperties: function(shape) {
        var context = Firebug.currentContext;
        var type = shape.shape && shape.shape.type;
        var title = "";
        if(!type) {
            return title;
        }
        var dojoAccessor = DojoAccess.getImpl(context);
        var gfx = dojoAccessor.getGfxModule(context);
        var props = gfx['default'+this._toTitleCase(type)];
        if(props) {
            title += '{ ';
            for(var k in props) {
                if(props.hasOwnProperty(k)) {
                    title += k + '=' + shape.shape[k] + ', ';
                }
            }
            title += '}';
        }
        return title;
    },
    
    _toTitleCase: function(str) {
        return str.replace(/\w\S*/g, function(txt){ return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();} );
    },

    /**
     * returns 'detached' string if the shape is not visible in the page.
     */
    /*string*/getDetachedClassName: function(shape) {
        return this.isDetached(shape) ? "detached" : "";
    },
    
    supportsObject: function(object, type, context) {
        var ctx = context ? context : Firebug.currentContext;
        var dojoAccessor = DojoAccess.getImpl(ctx);
        var res = dojoAccessor.isGfxObject(object, context);
        return res;
    },
    
    highlightObject: function(shape, context) {
        //clear any other hightlighted areas.
        Firebug.Inspector.highlightObject(null);

        if(context.dojo.gfxHighlightedShape) {
            this.unhighlightObject(context.dojo.gfxHighlightedShape, context);
        }

        var dojoAccessor = DojoAccess.getImpl(context);

        if(!shape || !dojoAccessor.isGfxObject(shape, context)) {
            return;
        }

        //different handling for Surfaces vs Shapes        
        if(dojoAccessor.isGfxSurface(shape, context)) {
            var domElem = this._getHtmlNode(shape);        
            Firebug.Inspector.highlightObject(domElem, context);           
            return;
        }

        // FBTrace.sysout("HIGHLIGHT "+shape, {shape:shape});
        var origStroke = shape.getStroke();        
        // FBTrace.sysout("HIGHLIGHT with stroke "+shape, {shape:shape, stroke:origStroke});
        this._setShapeValue(shape, "dojoext_gfx_origStroke", origStroke);
        context.dojo.gfxHighlightedShape = shape;
        shape.setStroke(this.customInspectHighlightStroke);
    },
    
    unhighlightObject: function(shape, context) {
        // FBTrace.sysout("UN-HIGHLIGHT "+shape, {shape:shape});
        var dojoAccessor = DojoAccess.getImpl(context);

        //different handling for Surfaces vs Shapes    
        if(dojoAccessor.isGfxSurface(shape, context)) {            
            Firebug.Inspector.highlightObject(null);
            return;
        }

        shape = context.dojo.gfxHighlightedShape;
        delete context.dojo.gfxHighlightedShape;
        
        if(!shape || !dojoAccessor.isGfxObject(shape, context)) {
            return;
        }        

        var origStroke = shape.dojoext_gfx_origStroke;
        // FBTrace.sysout("UN-HIGHLIGHT with stroke "+shape, {shape:shape, stroke:origStroke});
        delete shape.dojoext_gfx_origStroke;
        shape.setStroke(origStroke);
    },

    _setShapeValue: function(obj, key, value) {
       if(Object.defineProperty) {
           Object.defineProperty(obj, key, { 'value': value, writable: true, enumerable: false, configurable: true });
       } else {
           //traditional way..
           obj[key] = value;
       }        
    },
        
    _getHtmlNode: function(shape) {
        return shape['rawNode'];
    },
    
    _inspectHtml: function(shape, context) {
        Firebug.chrome.select(this._getHtmlNode(shape), Firebug.HTMLPanel.prototype.name);
    },

    getContextMenuItems: function(shape, target, context, script) {
        if (!shape) {
            return;
        }
    
        
        return [
            "-",
            {label: UI.$STRF("InspectInTab", ["HTML"]), nol10n: true, command: Obj.bindFixed(this._inspectHtml, this, shape, context) }
        ];
    },
    
    getTooltip: function(shape) {
        var shapeLabel = '[' + this.getShapeType(shape) + ']';
        
        if(this.isDetached(shape)) {
            shapeLabel = UI.$STR('detached.tooltip.gfx') + ": " + shape;
        }
        
        return shapeLabel;
    }
            
});

//************************************************************************************************

GfxReps.ShapesTreeRep = domplate({
    //"object" is an array of shapes (the roots)
    //expandPath will be an array of shapes
    tag: DIV({"class": "widgets-tree", _expandPath: "$expandPath"},
            FOR("wrapper", "$object",
                DIV({style: "padding-left: $wrapper|indent"},
                    TAG("$shapeTreeRow", {root: "$wrapper.shape", wrapper: "$wrapper", level: 0})
                )
            )
        ),

    shapeTreeRow:    DIV({"class": "collapsable-container container-collapsed collapsable-children-container $wrapper|shouldChildrenStartOpenedClass widget-info-level-none", _repShape:"$wrapper.shape",
                            _level: "$level"},
                        DIV({"class": "widget-label"},
                                SPAN({"class": "collapsable-children-label $wrapper|hasChildrenClass", onclick: "$onChildrenContainerClick" },
                                        TAG(GfxReps.ShapeRep.tag, {object: "$wrapper.shape"})
                                )
                            ),
                        DIV({"class": "widget-data widget-data-collapsed collapsable-content", _referencedObject:"$wrapper.shape"},
                                DIV({"class": "widget-specific-data not-loaded"}),
                                DIV({"class": "widget-full-data not-loaded"}),
                                DIV({"class": "widget-none-data not-loaded"})
                            ),
                        DIV({"class": "collapsable-children", _referencedObject:"$wrapper.shape"},
                                DIV({"class": "children $wrapper|shouldChildrenBeLoadedClass"},
                                    TAG("$loopChildren", {children: "$wrapper|getChildrenIfNeeded"})
                                )                                
                        )                        
                    ),
 
    loopChildren:    FOR("wrapper", "$children",
                        DIV({style: "padding-left: $wrapper|indent"},
                            TAG("$shapeTreeRow", {wrapper: "$wrapper", level: "$wrapper|level"})
                        )
                    ),

    collapsedChildrenNode: DIV({"class": "children not-loaded"}),
    
    shouldChildrenStartOpenedClass: function(wrapper) {
        var res = this._contains(wrapper.shape, wrapper.expandPath) ? "children-opened" : "children-collapsed";
        //FBTrace.sysout("should start open:"+wrapper.shape+" res:"+res, {w: wrapper.shape, path: wrapper.expandPath});
        return res;
    },
    shouldChildrenBeLoadedClass: function(wrapper) {
        var res = this._contains(wrapper.shape, wrapper.expandPath) ? "" : "not-loaded";
        return res;
    },
    _contains: function(elem, array) {
        if(!array) {
          return false;
        }
        var ctx = Firebug.currentContext;
        var dojoAccessor = DojoAccess.getImpl(ctx);
 
        var i;
        for(i=0;i<array.length;i++) {
            if(dojoAccessor.areTheSameGfxObjects(elem, array[i], ctx)) {
                return true;
            }
        }
        return false;        
    },

    /*int*/level: function(wrapper) {
        return wrapper.level ? parseInt(wrapper.level) : 0;
    },
    /*string*/indent: function(wrapper) {
        return (this.level(wrapper) * 16) + "px";
    },
    
    getChildren: function(shape) {
        var ctx = Firebug.currentContext;
        var dojoAccessor = DojoAccess.getImpl(ctx);
        var children = dojoAccessor.getChildrenShapes(shape, ctx);
        return children;
    },
    hasChildren: function(shape) {
        return this.getChildren(shape).length > 0;
    },
    hasChildrenClass: function(wrapper) {
        return this.hasChildren(wrapper.shape) ? "with-children" : "with-no-children";
    },
    
    _getExpandPath: function(node) {
        var root = Dom.getAncestorByClass(node, "widgets-tree");
        return root.expandPath;
    },    
    onChildrenContainerClick: function(event) {
        if (!Events.isLeftClick(event)) { 
            return;
        }

        var elem = Dom.getAncestorByClass(event.target, "collapsable-children-container");

        if(!this.hasChildren(elem.repShape)) {
            return;
        }
        var level = parseInt(elem.level);
        this.lazyChildrenLoad(elem, elem.repShape, level + 1);
        this.toggleChildren(elem);
      },    
    
    toggleChildren: function(container){
        if(Css.hasClass(container, "children-collapsed")) {
            Css.removeClass(container, "children-collapsed");
            Css.setClass(container, "children-opened");
        } else {
            Css.removeClass(container, "children-opened");
            Css.setClass(container, "children-collapsed");
        }
    },
    
    //display children
    lazyChildrenLoad: function(parentNode, shape, level) {
        var nodes = parentNode.getElementsByClassName("children");
        var node = (nodes) ? nodes[0] : null;
        if(node && Css.hasClass(node, "not-loaded")) {
            var expandPath = this._getExpandPath(node);
            var childrenWrappers = this.getChildrenWrappers(shape, level, expandPath);
            this.loopChildren.replace({'children': childrenWrappers}, node);
            Css.removeClass(node, "not-loaded");
        }
    },
    
    getChildrenIfNeeded: function(wrapper) {
        var shape = wrapper.shape;
        var level = wrapper.level;
        if(!this._contains(shape, wrapper.expandPath)) {
            //just don't return children if not included in expandPath
            return []; 
        }
        return this.getChildrenWrappers(shape, level + 1, wrapper.expandPath);
    },
    
    getChildrenWrappers: function(shape, childrenLevel, expandPath) {
        var children = this.getChildren(shape);
        var wrappers = [];
        var i;
        for (i = 0; i < children.length; i++ ) {
            wrappers.push({'shape': children[i], 'level': childrenLevel, 'expandPath': expandPath});
        }
        return wrappers;
    },
    createWrappersForShapes: function(shapes, expandPath) {
        var wrappers = [];
        var i;
        for(i=0; i < shapes.length; i++) {
            wrappers.push({ 'shape': shapes[i], 'level': 0, 'expandPath': expandPath });
        }        
        return wrappers;
    }

});

//************************************************************************************************

//called by dojofirebugextension
GfxReps.registerReps = function() {
    //'this' is GfxReps
    Firebug.registerRep(this.ShapeRep);
};

//called by dojofirebugextension
GfxReps.unregisterReps = function() {
    //'this' is GfxReps
    Firebug.unregisterRep(this.ShapeRep);
};


//************************************************************************************************

return GfxReps; 

}});