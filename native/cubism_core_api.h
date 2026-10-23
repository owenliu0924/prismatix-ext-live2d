/*
 * The slice of the Cubism Core C API this sample uses, declared here so the
 * bridge builds without Live2D's files. It is NOT Live2D's header: it was
 * written from the public API description, then checked against the
 * Live2DCubismCore.h of the Cubism SDK for Native 5-r.5 (Core 06.00.0001).
 * The bridge loads Core at run time (LoadLibrary / dlopen), so a prototype
 * that differs from the header of your SDK would compile and then misbehave.
 * Run `cubism_smoke` against your Core and a .moc3 first; it prints what it
 * read and fails loudly on anything implausible.
 *
 * Live2D's Core is proprietary: this sample neither contains nor
 * redistributes it. You supply the library (see the README).
 */
#ifndef PX_CUBISM_CORE_API_H
#define PX_CUBISM_CORE_API_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct csmMoc csmMoc;
typedef struct csmModel csmModel;
typedef unsigned char csmFlags;
typedef struct csmVector2 {
    float X;
    float Y;
} csmVector2;

/* Alignment Core requires for the memory it revives a moc and a model in. */
#define PX_CSM_ALIGN_MOC 64u
#define PX_CSM_ALIGN_MODEL 16u

/* csmGetDrawableConstantFlags */
#define PX_CSM_BLEND_ADDITIVE 1u
#define PX_CSM_BLEND_MULTIPLICATIVE 2u
#define PX_CSM_IS_DOUBLE_SIDED 4u
#define PX_CSM_IS_INVERTED_MASK 8u
/* csmGetDrawableDynamicFlags */
#define PX_CSM_IS_VISIBLE 1u
#define PX_CSM_VISIBILITY_DID_CHANGE 2u
#define PX_CSM_OPACITY_DID_CHANGE 4u
#define PX_CSM_DRAW_ORDER_DID_CHANGE 8u
#define PX_CSM_RENDER_ORDER_DID_CHANGE 16u
#define PX_CSM_VERTEX_POSITIONS_DID_CHANGE 32u

/* X(return type, symbol, parameter list) for every Core function the bridge calls. */
#define PX_CSM_FUNCTIONS(X) \
    X(unsigned int, csmGetVersion, (void)) \
    X(unsigned int, csmGetLatestMocVersion, (void)) \
    X(unsigned int, csmGetMocVersion, (const void* address, const unsigned int size)) \
    X(csmMoc*, csmReviveMocInPlace, (void* address, const unsigned int size)) \
    X(unsigned int, csmGetSizeofModel, (const csmMoc* moc)) \
    X(csmModel*, csmInitializeModelInPlace, (const csmMoc* moc, void* address, const unsigned int size)) \
    X(void, csmUpdateModel, (csmModel* model)) \
    X(void, csmReadCanvasInfo, (const csmModel* model, csmVector2* outSizeInPixels, \
                                csmVector2* outOriginInPixels, float* outPixelsPerUnit)) \
    X(int, csmGetParameterCount, (const csmModel* model)) \
    X(const char**, csmGetParameterIds, (const csmModel* model)) \
    X(const float*, csmGetParameterMinimumValues, (const csmModel* model)) \
    X(const float*, csmGetParameterMaximumValues, (const csmModel* model)) \
    X(const float*, csmGetParameterDefaultValues, (const csmModel* model)) \
    X(float*, csmGetParameterValues, (csmModel* model)) \
    X(int, csmGetPartCount, (const csmModel* model)) \
    X(const char**, csmGetPartIds, (const csmModel* model)) \
    X(float*, csmGetPartOpacities, (csmModel* model)) \
    X(int, csmGetDrawableCount, (const csmModel* model)) \
    X(const char**, csmGetDrawableIds, (const csmModel* model)) \
    X(const csmFlags*, csmGetDrawableConstantFlags, (const csmModel* model)) \
    X(const csmFlags*, csmGetDrawableDynamicFlags, (const csmModel* model)) \
    X(const int*, csmGetDrawableTextureIndices, (const csmModel* model)) \
\
    X(const float*, csmGetDrawableOpacities, (const csmModel* model)) \
    X(const int*, csmGetDrawableMaskCounts, (const csmModel* model)) \
    X(const int**, csmGetDrawableMasks, (const csmModel* model)) \
    X(const int*, csmGetDrawableVertexCounts, (const csmModel* model)) \
    X(const csmVector2**, csmGetDrawableVertexPositions, (const csmModel* model)) \
    X(const csmVector2**, csmGetDrawableVertexUvs, (const csmModel* model)) \
    X(const int*, csmGetDrawableIndexCounts, (const csmModel* model)) \
    X(const unsigned short**, csmGetDrawableIndices, (const csmModel* model)) \
    X(void, csmResetDrawableDynamicFlags, (csmModel* model))

/*
 * Functions whose name depends on the Core. Render orders: Cores of Cubism
 * 5.3 and later (moc3 version 6, which adds offscreens) export
 * csmGetRenderOrders, one entry per drawable and then one per offscreen;
 * older Cores export csmGetDrawableRenderOrders, one per drawable. Both take
 * the model and return const int*. csmHasMocConsistency (Core 4.2 and later)
 * checks a .moc3 before it is revived; without it the bridge skips the check.
 */
typedef const int* (*PxCsmRenderOrders)(const csmModel* model);
typedef int (*PxCsmHasMocConsistency)(void* address, const unsigned int size);

typedef struct CubismCoreApi {
#define PX_CSM_FIELD(ret, name, args) ret(*name) args;
    PX_CSM_FUNCTIONS(PX_CSM_FIELD)
#undef PX_CSM_FIELD
    PxCsmRenderOrders renderOrders;
    PxCsmHasMocConsistency hasMocConsistency; /* may be NULL */
} CubismCoreApi;

#ifdef __cplusplus
}
#endif

#endif /* PX_CUBISM_CORE_API_H */
